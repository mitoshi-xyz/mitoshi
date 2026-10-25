//! Sending: propose a single payment, then build (prove and sign) it.
//!
//! One pool per transaction, so no send publishes a pool crossing's value:
//! - a payment (`kind: "pay"`) spends Ironwood notes only, with change to Ironwood. A payment to a
//!   transparent address (a NEAR 1Click deposit) publishes only that payment's amount.
//! - a migration (`kind: "migrate"`) moves Orchard value to Ironwood as a ZIP 318 canonical
//!   crossing: one Orchard note in, one standard denomination out to this account's internal
//!   address, at most one Orchard change output, the canonical fee and a bucketed anchor. A
//!   proposal that is not exactly that shape is refused rather than sent.

use std::{cell::RefCell, collections::HashMap, convert::Infallible, str::FromStr};

use rand::{rand_core::UnwrapErr, rngs::SysRng};
use secrecy::ExposeSecret;
use serde_json::{Value, json};
use zcash_address::ZcashAddress;
use zcash_client_backend::{
    data_api::{
        Account as _, WalletRead,
        wallet::{
            ConfirmationsPolicy, SpendingKeys, create_proposed_transactions,
            input_selection::{GreedyInputSelector, SpendPolicy},
            propose_transfer,
        },
    },
    fees::{DustOutputPolicy, SplitPolicy, canonical_crossing_fee, zip317::MultiOutputChangeStrategy},
    proposal::Proposal,
    wallet::OvkPolicy,
};
use zcash_client_sqlite::{ReceivedNoteId, util::SystemClock};
use zcash_keys::{
    address::{Address, UnifiedAddress},
    keys::UnifiedSpendingKey,
};
use zcash_primitives::transaction::fees::zip317::FeeRule;
use zcash_protocol::{ShieldedPool, value::Zatoshis};
use zip321::{Payment, TransactionRequest};

use crate::{Ctx, Error, State, prover::NoSapling, wallet::seed_from};

type Pending = Proposal<FeeRule, ReceivedNoteId>;

thread_local! {
    static PROPOSALS: RefCell<HashMap<u32, Pending>> = RefCell::new(HashMap::new());
    static NEXT_ID: RefCell<u32> = const { RefCell::new(1) };
}

fn account(state: &State) -> Result<<crate::Db as WalletRead>::AccountId, Error> {
    state
        .db
        .get_account_ids()
        .ctx("listing accounts")?
        .first()
        .copied()
        .ok_or_else(|| Error::msg("no account yet"))
}

/// This account's internal (change) address, as a unified address with only its Orchard-protocol
/// receiver: since NU6.3 a payment to it lands in Ironwood. ZIP 318 sends every migration here.
fn internal_address(state: &State, account: <crate::Db as WalletRead>::AccountId) -> Result<String, Error> {
    let fvk = state
        .db
        .get_account(account)
        .ctx("reading the account")?
        .and_then(|a| a.ufvk().and_then(|k| k.orchard().cloned()))
        .ok_or_else(|| Error::msg("this account has no Orchard viewing key"))?;
    let orchard = fvk.address_at(0u32, orchard::keys::Scope::Internal);
    let ua = UnifiedAddress::from_receivers(Some(orchard), None, None, None, None)
        .ok_or_else(|| Error::msg("could not form the internal address"))?;
    Ok(ua.encode(&state.network))
}

/// `{kind?, to, zat}` or `{payments: [{to, zat}…]}` → `{id, fee, minTargetHeight, transparent}`. `kind` is "pay"
/// (the default) or "migrate" (no `to`: the crossing goes to this account's internal address). Several payments go
/// in one transaction (setting up the judges' desks pays each its share at once); they must all be shielded, so one
/// transaction never mixes a public output in with private ones. The proposal is kept until `build` uses it.
pub fn propose(state: &mut State, args: &Value) -> Result<Value, Error> {
    let migrate = match args.get("kind").and_then(Value::as_str).unwrap_or("pay") {
        "pay" => false,
        "migrate" => true,
        other => return Err(Error::msg(format!("unknown send kind {other}"))),
    };
    let network = state.network;
    let account = account(state)?;
    let many = args.get("payments").and_then(Value::as_array);
    let wanted: Vec<(String, u64)> = match (migrate, many) {
        (true, _) => {
            let zat = args.get("zat").and_then(Value::as_u64).ok_or_else(|| Error::msg("missing zat"))?;
            vec![(internal_address(state, account)?, zat)]
        }
        (false, Some(list)) => list
            .iter()
            .map(|p| {
                let to = p.get("to").and_then(Value::as_str).ok_or_else(|| Error::msg("a payment is missing to"))?;
                let zat = p.get("zat").and_then(Value::as_u64).ok_or_else(|| Error::msg("a payment is missing zat"))?;
                Ok((to.to_owned(), zat))
            })
            .collect::<Result<_, Error>>()?,
        (false, None) => {
            let to = args.get("to").and_then(Value::as_str).ok_or_else(|| Error::msg("missing to"))?;
            let zat = args.get("zat").and_then(Value::as_u64).ok_or_else(|| Error::msg("missing zat"))?;
            vec![(to.to_owned(), zat)]
        }
    };
    if wanted.is_empty() {
        return Err(Error::msg("no payments"));
    }
    let mut transparent = false;
    let mut payments = Vec::with_capacity(wanted.len());
    for (to, zat) in &wanted {
        let public = match Address::decode(&network, to) {
            Some(Address::Transparent(_)) | Some(Address::Tex(_)) => true,
            Some(Address::Unified(ua)) if ua.has_orchard() => false,
            Some(_) => {
                return Err(Error::msg("recipient must be a transparent address or a UA with an Orchard receiver"));
            }
            None => return Err(Error::msg("recipient is not a valid address on this network")),
        };
        if public && wanted.len() > 1 {
            return Err(Error::msg("a payment to several recipients pays shielded addresses only"));
        }
        transparent |= public;
        let recipient = ZcashAddress::from_str(to).ctx("recipient")?;
        let amount = Zatoshis::from_u64(*zat).ctx("amount")?;
        // No memos, ever: a transparent output cannot carry one, and a shielded memo is a fingerprint.
        payments.push(Payment::new(recipient, Some(amount), None, None, None, vec![]).ctx("payment")?);
    }
    let request = TransactionRequest::new(payments).ctx("payment request")?;
    // The pool spent from is the pool change returns to: a payment never touches Orchard, and a
    // migration's only Ironwood output is the denomination itself.
    let pool = if migrate { ShieldedPool::Orchard } else { ShieldedPool::Ironwood };
    let change = MultiOutputChangeStrategy::new(
        FeeRule::standard(),
        None,
        pool,
        DustOutputPolicy::default(),
        SplitPolicy::single_output(),
    );
    let spend_policy = SpendPolicy::shielded_pools([pool]);
    let proposal: Pending = propose_transfer::<_, _, _, _, Infallible>(
        &mut state.db,
        &network,
        account,
        &GreedyInputSelector::new(),
        &change,
        request,
        ConfirmationsPolicy::default(),
        &spend_policy,
        None,
        None,
    )
    .map_err(|e| Error::msg(format!("proposal: {e}")))?;
    let fee: u64 = proposal.steps().iter().map(|s| s.balance().fee_required().into_u64()).sum();
    let min_target = u32::from(proposal.min_target_height());
    if migrate {
        let canonical_fee = canonical_crossing_fee(&network, proposal.min_target_height().into())
            .map_err(|e| Error::msg(format!("canonical crossing fee: {e:?}")))?;
        let params = state.db.pool_migration_params(&network);
        let steps = proposal.steps();
        if steps.len() != 1 || !steps.first().is_canonical_crossing(&params, canonical_fee) {
            return Err(Error::msg(
                "no single Orchard note can make this a canonical ZIP 318 crossing; nothing was sent",
            ));
        }
    }
    let id = NEXT_ID.with(|n| {
        let mut n = n.borrow_mut();
        let id = *n;
        *n += 1;
        id
    });
    PROPOSALS.with(|p| p.borrow_mut().insert(id, proposal));
    Ok(json!({ "id": id, "fee": fee, "minTargetHeight": min_target, "transparent": transparent }))
}

/// `{id, seed}` → `{txid, raw}` (hex). Proves and signs; the caller broadcasts `raw`.
pub fn build(state: &mut State, args: &Value) -> Result<Value, Error> {
    let id = args.get("id").and_then(Value::as_u64).and_then(|v| u32::try_from(v).ok()).ok_or_else(|| Error::msg("missing id"))?;
    let proposal = PROPOSALS
        .with(|p| p.borrow_mut().remove(&id))
        .ok_or_else(|| Error::msg("unknown or used proposal"))?;
    let seed = seed_from(args)?;
    let network = state.network;
    let account_id = account(state)?;
    let derivation = state
        .db
        .get_account(account_id)
        .ctx("reading the account")?
        .and_then(|a| a.source().key_derivation().cloned())
        .ok_or_else(|| Error::msg("this account cannot spend"))?;
    let usk = UnifiedSpendingKey::from_seed(&network, seed.expose_secret(), derivation.account_index())
        .ctx("deriving the spending key")?;
    drop(seed);
    let txids = create_proposed_transactions::<_, _, Infallible, _, Infallible, _>(
        &mut state.db,
        &network,
        &SystemClock,
        &mut UnwrapErr(SysRng),
        &NoSapling,
        &NoSapling,
        &SpendingKeys::from_unified_spending_key(usk),
        OvkPolicy::Discard,
        &proposal,
        None,
    )
    .map_err(|e| Error::msg(format!("building the transaction: {e}")))?;
    let txid = *txids.first();
    let tx = state.db.get_transaction(txid).ctx("reading the built transaction")?.ok_or_else(|| Error::msg("built transaction not stored"))?;
    let mut raw = vec![];
    tx.write(&mut raw).ctx("serializing the transaction")?;
    Ok(json!({ "txid": txid.to_string(), "raw": hex::encode(raw) }))
}

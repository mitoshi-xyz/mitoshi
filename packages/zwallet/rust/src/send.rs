//! Sending: propose a single payment, then build (prove and sign) it.
//!
//! Inputs come only from the Ironwood and Orchard pools, and change always goes to Ironwood. A
//! payment to a transparent address (a NEAR 1Click deposit) therefore publishes only that
//! payment's amount; the change and the sender stay shielded.

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
    fees::{DustOutputPolicy, SplitPolicy, zip317::MultiOutputChangeStrategy},
    proposal::Proposal,
    wallet::OvkPolicy,
};
use zcash_client_sqlite::{ReceivedNoteId, util::SystemClock};
use zcash_keys::{address::Address, keys::UnifiedSpendingKey};
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

/// `{to, zat}` → `{id, fee, minTargetHeight}`. The proposal is kept until `build` uses it.
pub fn propose(state: &mut State, args: &Value) -> Result<Value, Error> {
    let to = args.get("to").and_then(Value::as_str).ok_or_else(|| Error::msg("missing to"))?;
    let zat = args.get("zat").and_then(Value::as_u64).ok_or_else(|| Error::msg("missing zat"))?;
    let network = state.network;
    let transparent = match Address::decode(&network, to) {
        Some(Address::Transparent(_)) | Some(Address::Tex(_)) => true,
        Some(Address::Unified(ua)) if ua.has_orchard() => false,
        Some(_) => return Err(Error::msg("recipient must be a transparent address or a UA with an Orchard receiver")),
        None => return Err(Error::msg("recipient is not a valid address on this network")),
    };
    let recipient = ZcashAddress::from_str(to).ctx("recipient")?;
    let amount = Zatoshis::from_u64(zat).ctx("amount")?;
    // No memos, ever: a transparent output cannot carry one, and a shielded memo is a fingerprint.
    let payment = Payment::new(recipient, Some(amount), None, None, None, vec![]).ctx("payment")?;
    let request = TransactionRequest::new(vec![payment]).ctx("payment request")?;
    let change = MultiOutputChangeStrategy::new(
        FeeRule::standard(),
        None,
        ShieldedPool::Ironwood,
        DustOutputPolicy::default(),
        SplitPolicy::single_output(),
    );
    let spend_policy = SpendPolicy::shielded_pools([ShieldedPool::Ironwood, ShieldedPool::Orchard]);
    let account = account(state)?;
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

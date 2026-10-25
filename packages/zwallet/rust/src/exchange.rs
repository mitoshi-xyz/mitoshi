//! Receiving from exchanges. Exchanges pay ZEC only to transparent addresses, so a deposit from one
//! goes to a fresh transparent receive address of this account; the light server reports what
//! arrives (JS fetches `GetAddressUtxos` and passes the reply in), and a shielding transaction moves
//! it into Ironwood, after which it is an ordinary shielded note (and, having come from a public
//! address, rests before it can fund anything).

use std::convert::Infallible;

use prost::Message as _;
use rand::{rand_core::UnwrapErr, rngs::SysRng};
use secrecy::ExposeSecret;
use serde_json::{Value, json};
use transparent::{
    address::TransparentAddress,
    bundle::{OutPoint, TxOut},
    keys::TransparentKeyScope,
};
use zcash_client_backend::{
    data_api::{
        Account as _, CoinbaseFilter, WalletRead, WalletWrite,
        wallet::{
            ConfirmationsPolicy, SpendingKeys, create_proposed_transactions, input_selection::GreedyInputSelector,
            propose_shielding,
        },
    },
    fees::{DustOutputPolicy, SplitPolicy, zip317::MultiOutputChangeStrategy},
    proto::service::GetAddressUtxosReplyList,
    wallet::{OvkPolicy, WalletTransparentOutput},
};
use zcash_client_sqlite::util::SystemClock;
use zcash_keys::{
    address::Address,
    keys::{ReceiverRequirement, ReceiverRequirements, UnifiedAddressRequest, UnifiedSpendingKey},
};
use zcash_primitives::transaction::fees::zip317::FeeRule;
use zcash_protocol::{ShieldedPool, consensus::BlockHeight, value::Zatoshis};

use crate::{Ctx, Error, State, prover::NoSapling, wallet::{account_id, seed_from}};

/// Below this, a transparent balance is not worth its shielding fee and waits for more to arrive.
const SHIELD_THRESHOLD_ZAT: u64 = 100_000;

/// A never-used transparent address of this account, for one exchange deposit (ZIP 316: the
/// transparent receiver of a fresh unified address, so each deposit has its own).
pub fn receive_address(state: &mut State) -> Result<Value, Error> {
    let account = account_id(&state.db)?;
    let request = ReceiverRequirements::new(ReceiverRequirement::Require, ReceiverRequirement::Omit, ReceiverRequirement::Require)
        .map(UnifiedAddressRequest::Custom)
        .map_err(|e| Error::msg(format!("address request: {e:?}")))?;
    let (ua, _) = state
        .db
        .get_next_available_address(account, request)
        .ctx("deriving a transparent address")?
        .ok_or_else(|| Error::msg("no further addresses available"))?;
    let taddr = ua.transparent().ok_or_else(|| Error::msg("the address has no transparent receiver"))?;
    Ok(json!({ "address": Address::from(*taddr).encode(&state.network) }))
}

fn receivers(state: &State) -> Result<Vec<TransparentAddress>, Error> {
    let account = account_id(&state.db)?;
    Ok(state.db.get_transparent_receivers(account, false, false).ctx("listing transparent addresses")?.into_keys().collect())
}

/// Every transparent receive address this account has handed out, for the light server to check.
pub fn list(state: &mut State) -> Result<Value, Error> {
    let network = state.network;
    let addresses: Vec<String> = receivers(state)?.into_iter().map(|a| Address::from(a).encode(&network)).collect();
    Ok(json!({ "addresses": addresses }))
}

/// Stores the outputs in a `GetAddressUtxosReplyList` (protobuf bytes) that pay this account's
/// transparent addresses → `{stored, zat}`.
pub fn put_utxos(state: &mut State, bin: &[u8]) -> Result<Value, Error> {
    let reply = GetAddressUtxosReplyList::decode(bin).ctx("decoding the UTXO list")?;
    let account = account_id(&state.db)?;
    let mine = receivers(state)?;
    let network = state.network;
    let (mut stored, mut zat) = (0u32, 0u64);
    for u in reply.address_utxos {
        let Some(Address::Transparent(taddr)) = Address::decode(&network, &u.address) else { continue };
        if !mine.contains(&taddr) {
            continue;
        }
        let txid: [u8; 32] = u.txid.as_slice().try_into().map_err(|_| Error::msg("a UTXO txid is not 32 bytes"))?;
        let index = u32::try_from(u.index).map_err(|_| Error::msg("a UTXO index is negative"))?;
        let value = Zatoshis::from_nonnegative_i64(u.value_zat).map_err(|_| Error::msg("a UTXO value is out of range"))?;
        let height = u32::try_from(u.height).map_err(|_| Error::msg("a UTXO height is out of range"))?;
        let output = WalletTransparentOutput::from_parts(
            OutPoint::new(txid, index),
            TxOut::new(value, taddr.script().into()),
            Some(BlockHeight::from(height)),
            Some(account),
            Some(TransparentKeyScope::EXTERNAL),
            None,
        )
        .ok_or_else(|| Error::msg("a UTXO does not pay a transparent address"))?;
        state.db.put_received_transparent_utxo(&output).ctx("storing a UTXO")?;
        stored += 1;
        zat += value.into_u64();
    }
    Ok(json!({ "stored": stored, "zat": zat }))
}

/// `{seed}` → `{txid, raw, fee, zat}`: moves every transparent output into Ironwood in one
/// shielding transaction, or `{txid: null}` when there is not enough to be worth the fee.
pub fn shield(state: &mut State, args: &Value) -> Result<Value, Error> {
    let network = state.network;
    let account = account_id(&state.db)?;
    let from = receivers(state)?;
    let change = MultiOutputChangeStrategy::new(
        FeeRule::standard(),
        None,
        ShieldedPool::Ironwood,
        DustOutputPolicy::default(),
        SplitPolicy::single_output(),
    );
    // Nothing, or too little to be worth the fee, is the normal case between deposits.
    let ready = state
        .db
        .get_wallet_summary(ConfirmationsPolicy::default())
        .ctx("reading the balance")?
        .and_then(|s| s.account_balances().get(&account).map(|b| b.unshielded_balance().spendable_value().into_u64()))
        .unwrap_or(0);
    if ready < SHIELD_THRESHOLD_ZAT {
        return Ok(json!({ "txid": null, "ready": ready }));
    }
    let proposal = propose_shielding::<_, _, _, _, Infallible>(
        &mut state.db,
        &network,
        &GreedyInputSelector::new(),
        &change,
        Zatoshis::const_from_u64(SHIELD_THRESHOLD_ZAT),
        &from,
        account,
        ConfirmationsPolicy::default(),
        CoinbaseFilter::default(),
        None,
    )
    .map_err(|e| Error::msg(format!("shielding proposal: {e}")))?;
    let fee: u64 = proposal.steps().iter().map(|s| s.balance().fee_required().into_u64()).sum();
    let seed = seed_from(args)?;
    let derivation = state
        .db
        .get_account(account)
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
    .map_err(|e| Error::msg(format!("building the shielding transaction: {e}")))?;
    let txid = *txids.first();
    let tx = state.db.get_transaction(txid).ctx("reading the built transaction")?.ok_or_else(|| Error::msg("built transaction not stored"))?;
    let mut raw = vec![];
    tx.write(&mut raw).ctx("serializing the transaction")?;
    let zat: u64 = proposal.steps().iter().flat_map(|s| s.transparent_inputs()).map(|i| i.value().into_u64()).sum();
    Ok(json!({ "txid": txid.to_string(), "raw": hex::encode(raw), "fee": fee, "zat": zat }))
}

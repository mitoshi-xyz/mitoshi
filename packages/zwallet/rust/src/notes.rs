//! Notes, their origin, rest locks, transaction enhancement and history.
//!
//! Compact blocks carry only the shielded parts of a transaction, so a freshly scanned note's
//! origin is unknown. The wallet asks for the full transactions it needs
//! ([`data_requests`]), JS fetches them from the light server over OHTTP, and [`store_tx`] hands
//! them to `zcash_client_sqlite`. A note whose transaction spent transparent inputs came from a
//! public address (an exchange, or a NEAR 1Click payout); the engine rests those notes by locking
//! them until a random height, using the wallet store's own output locks ([`lock`]).

use serde_json::{Value, json};
use zcash_client_backend::{
    data_api::{
        InputSource, OutputLockStore, TransactionDataRequest, TransactionStatus, WalletRead, WalletWrite,
        locking::{LockFilter, LockOwner},
        wallet::{TargetHeight, decrypt_and_store_transaction},
    },
    wallet::OutputRef,
};
use zcash_primitives::transaction::Transaction;
use zcash_protocol::{
    PoolType, ShieldedPool,
    consensus::{BlockHeight, BranchId},
};
use zip32::Scope;

use crate::{Ctx, DB_PATH, Error, State, wallet::account_id};

/// The owner of every rest lock. Not a secret (see `LockOwner`): it only keeps rest locks apart
/// from any other lock a future flow might take.
const REST_OWNER: LockOwner = LockOwner::new(*b"mitoshi rest lock: public origin");

/// lightwalletd's `RawTransaction.height` for a transaction mined outside the main chain.
const NOT_IN_MAIN_CHAIN: u64 = u64::MAX;

/// Display-order hex (as explorers show it) to a `TxId`.
pub fn txid_from_hex(hex_txid: &str) -> Result<zcash_protocol::TxId, Error> {
    let mut bytes = hex::decode(hex_txid).ctx("txid is not hex")?;
    bytes.reverse();
    let bytes: [u8; 32] = bytes.try_into().map_err(|_| Error::msg("txid must be 32 bytes"))?;
    Ok(zcash_protocol::TxId::from_bytes(bytes))
}

fn pool_name(pool: ShieldedPool) -> &'static str {
    match pool {
        ShieldedPool::Sapling => "sapling",
        ShieldedPool::Orchard => "orchard",
        ShieldedPool::Ironwood => "ironwood",
    }
}

fn pool_from(name: &str) -> Result<ShieldedPool, Error> {
    match name {
        "orchard" => Ok(ShieldedPool::Orchard),
        "ironwood" => Ok(ShieldedPool::Ironwood),
        other => Err(Error::msg(format!("unsupported pool {other}"))),
    }
}

fn tip(state: &State) -> Result<BlockHeight, Error> {
    state.db.chain_height().ctx("reading the tip")?.ok_or_else(|| Error::msg("the wallet has not synced yet"))
}

/// Whether a stored transaction spent transparent inputs: `Some(true)` public origin,
/// `Some(false)` fully shielded, `None` when the full transaction is not stored yet.
fn public_origin(state: &State, txid: zcash_protocol::TxId) -> Result<Option<bool>, Error> {
    Ok(state
        .db
        .get_transaction(txid)
        .ctx("reading a transaction")?
        .map(|tx| tx.transparent_bundle().is_some_and(|b| !b.vin.is_empty())))
}

/// Every unspent Orchard and Ironwood note, locked or not, with where its value came from.
pub fn list(state: &mut State) -> Result<Value, Error> {
    let account = account_id(&state.db)?;
    let target = TargetHeight::from(tip(state)? + 1);
    let notes = state
        .db
        .select_unspent_notes(account, &[ShieldedPool::Orchard, ShieldedPool::Ironwood], target, &[], LockFilter::Unfiltered)
        .ctx("listing notes")?;
    let mut out = Vec::new();
    for (pool, list) in [(ShieldedPool::Orchard, notes.orchard()), (ShieldedPool::Ironwood, notes.ironwood())] {
        for n in list {
            let txid = *n.txid();
            let origin = match public_origin(state, txid)? {
                Some(true) => "public",
                Some(false) => "shielded",
                None => "unknown",
            };
            out.push(json!({
                "txid": txid.to_string(),
                "pool": pool_name(pool),
                "index": n.output_index(),
                "value": n.note().value().inner(),
                "minedHeight": n.mined_height().map(u32::from),
                "change": n.spending_key_scope() == Scope::Internal,
                "origin": origin,
            }));
        }
    }
    Ok(json!(out))
}

/// Full transactions (or statuses) the wallet still needs from the light server.
pub fn data_requests(state: &mut State) -> Result<Value, Error> {
    let requests = state.db.transaction_data_requests().ctx("listing data requests")?;
    let out: Vec<Value> = requests
        .into_iter()
        .filter_map(|r| match r {
            TransactionDataRequest::GetStatus(txid) => Some(json!({ "kind": "status", "txid": txid.to_string() })),
            TransactionDataRequest::Enhancement(txid) => Some(json!({ "kind": "enhance", "txid": txid.to_string() })),
            // Address-history requests only arise with transparent receivers, which Mitoshi never
            // hands out.
            #[allow(unreachable_patterns)]
            _ => None,
        })
        .collect();
    Ok(json!(out))
}

/// `{height}` + raw transaction bytes (lightwalletd `RawTransaction`): decrypts what belongs to
/// the wallet and stores the full transaction. Height 0 means still in the mempool.
pub fn store_tx(state: &mut State, args: &Value, raw: &[u8]) -> Result<Value, Error> {
    let height = args.get("height").and_then(Value::as_u64).unwrap_or(0);
    let network = state.network;
    if height == NOT_IN_MAIN_CHAIN {
        return Err(Error::msg("use txStatus for a transaction outside the main chain"));
    }
    let mined = (height > 0).then(|| BlockHeight::from(u32::try_from(height).unwrap_or(u32::MAX)));
    let parse_at = match mined {
        Some(h) => h,
        None => tip(state)? + 1,
    };
    let tx = Transaction::read(raw, BranchId::for_height(&network, parse_at)).ctx("parsing the transaction")?;
    decrypt_and_store_transaction(&network, &mut state.db, &tx, mined).ctx("storing the transaction")?;
    let transparent_inputs = tx.transparent_bundle().map_or(0, |b| b.vin.len());
    Ok(json!({ "txid": tx.txid().to_string(), "transparentInputs": transparent_inputs }))
}

/// `{txid, status}` with status `"unknown"` (the light server has never seen it) or
/// `"notInMainChain"`.
pub fn tx_status(state: &mut State, args: &Value) -> Result<Value, Error> {
    let txid = txid_from_hex(args.get("txid").and_then(Value::as_str).ok_or_else(|| Error::msg("missing txid"))?)?;
    let status = match args.get("status").and_then(Value::as_str) {
        Some("unknown") => TransactionStatus::TxidNotRecognized,
        Some("notInMainChain") => TransactionStatus::NotInMainChain,
        _ => return Err(Error::msg("status must be \"unknown\" or \"notInMainChain\"")),
    };
    state.db.set_transaction_status(txid, status).ctx("setting the status")?;
    Ok(Value::Null)
}

fn output_refs(args: &Value) -> Result<Vec<OutputRef>, Error> {
    let refs = args.get("notes").and_then(Value::as_array).ok_or_else(|| Error::msg("missing notes"))?;
    refs.iter()
        .map(|r| {
            let txid = txid_from_hex(r.get("txid").and_then(Value::as_str).ok_or_else(|| Error::msg("note without txid"))?)?;
            let pool = pool_from(r.get("pool").and_then(Value::as_str).unwrap_or_default())?;
            let index = r.get("index").and_then(Value::as_u64).ok_or_else(|| Error::msg("note without index"))?;
            Ok(OutputRef::new(txid, PoolType::Shielded(pool), u32::try_from(index).ctx("note index")?))
        })
        .collect()
}

/// `{notes: [{txid, pool, index}], untilHeight}`: rests the notes (they cannot be spent, and
/// count as locked in the balance) until the chain passes `untilHeight`. Re-locking with the
/// same height is a no-op, so the engine may call this on every sync.
pub fn lock(state: &mut State, args: &Value) -> Result<Value, Error> {
    let refs = output_refs(args)?;
    let until = args.get("untilHeight").and_then(Value::as_u64).ok_or_else(|| Error::msg("missing untilHeight"))?;
    let until = BlockHeight::from(u32::try_from(until).ctx("untilHeight")?);
    let n = state.db.lock_outputs(&refs, REST_OWNER, until).ctx("locking notes")?;
    Ok(json!(n))
}

/// `{notes: [...]}`: lifts rest locks (for notes that turned out to be fully shielded).
pub fn unlock(state: &mut State, args: &Value) -> Result<Value, Error> {
    let mut n = 0;
    for r in output_refs(args)? {
        if state.db.unlock_output(&r, REST_OWNER).ctx("unlocking a note")? {
            n += 1;
        }
    }
    Ok(json!(n))
}

/// The wallet's transactions, newest first (read straight from the store's `v_transactions`).
pub fn history(state: &mut State, args: &Value) -> Result<Value, Error> {
    let limit = args.get("limit").and_then(Value::as_u64).unwrap_or(100);
    let conn = rusqlite::Connection::open_with_flags(DB_PATH, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .ctx("opening the wallet for reading")?;
    let mut stmt = conn
        .prepare(
            "SELECT txid, mined_height, expiry_height, account_balance_delta, fee_paid, block_time,
                    expired_unmined, sent_note_count, received_note_count, is_shielding, raw IS NOT NULL
             FROM v_transactions
             ORDER BY mined_height IS NOT NULL, mined_height DESC, tx_index DESC
             LIMIT ?1",
        )
        .ctx("preparing the history query")?;
    let rows = stmt
        .query_map([limit], |row| {
            let mut txid: Vec<u8> = row.get(0)?;
            txid.reverse();
            Ok((
                hex::encode(txid),
                row.get::<_, Option<u32>>(1)?,
                row.get::<_, Option<u32>>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, bool>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, bool>(9)?,
                row.get::<_, bool>(10)?,
            ))
        })
        .ctx("reading history")?;
    // ZEC paid to one of our transparent addresses (an exchange withdrawal) arrived in public whatever it spent, and the
    // store keeps no full copy of such a transaction to read its inputs from.
    let mut to_transparent = conn
        .prepare(
            "SELECT EXISTS (SELECT 1 FROM transparent_received_outputs o
                            JOIN transactions t ON t.id_tx = o.transaction_id WHERE t.txid = ?1)",
        )
        .ctx("preparing the transparent receipt query")?;
    let mut out = Vec::new();
    for row in rows {
        let (txid, mined, expiry, delta, fee, time, expired, sent, received, shielding, full) = row.ctx("reading a row")?;
        let id = txid_from_hex(&txid)?;
        let public = if full {
            public_origin(state, id)?
        } else if to_transparent.query_row([id.as_ref().to_vec()], |r| r.get::<_, bool>(0)).ctx("reading a receipt")? {
            Some(true)
        } else {
            None
        };
        out.push(json!({
            "txid": txid,
            "minedHeight": mined,
            "expiryHeight": expiry,
            "delta": delta,
            "fee": fee,
            "time": time,
            "expired": expired,
            "sentNotes": sent,
            "receivedNotes": received,
            "internal": shielding,
            "fromPublic": public,
        }));
    }
    Ok(json!(out))
}

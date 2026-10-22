//! Opening the wallet, the single account, fresh addresses and the balance summary.

use prost::Message as _;
use rand::{rand_core::UnwrapErr, rngs::SysRng};
use secrecy::SecretVec;
use serde_json::{Value, json};
use zcash_client_backend::{
    data_api::{
        AccountBirthday, AccountBalance, Balance, WalletRead, WalletWrite,
        wallet::ConfirmationsPolicy,
    },
    proto::service::TreeState,
};
use zcash_client_sqlite::{WalletDb, util::SystemClock, wallet::init::init_wallet_db};
use zcash_keys::keys::UnifiedAddressRequest;
use zcash_protocol::consensus::Network;

use crate::{Ctx, DB_PATH, Db, Error, State};

/// Opens the database file and runs any pending migrations.
pub fn open(network: Network) -> Result<Db, Error> {
    let mut db = WalletDb::for_path(DB_PATH, network, SystemClock, UnwrapErr(SysRng)).ctx("opening the wallet")?;
    init_wallet_db(&mut db, None).ctx("migrating the wallet")?;
    Ok(db)
}

/// Mitoshi keeps exactly one Zcash account per device wallet.
fn account_id(db: &Db) -> Result<<Db as WalletRead>::AccountId, Error> {
    db.get_account_ids()
        .ctx("listing accounts")?
        .first()
        .copied()
        .ok_or_else(|| Error::msg("no account yet"))
}

pub fn has_account(state: &mut State) -> Result<Value, Error> {
    Ok(json!(!state.db.get_account_ids().ctx("listing accounts")?.is_empty()))
}

/// Creates the account from a 64-byte BIP 39 seed (hex) and the lightwalletd `TreeState` of the
/// block before the birthday (binary payload). Nothing secret is stored besides what
/// `zcash_client_sqlite` keeps (the viewing key); the seed itself stays in the JS vault.
pub fn create_account(state: &mut State, args: &Value, bin: &[u8]) -> Result<Value, Error> {
    if !state.db.get_account_ids().ctx("listing accounts")?.is_empty() {
        return Err(Error::msg("this wallet already has an account"));
    }
    let seed = seed_from(args)?;
    let treestate = TreeState::decode(bin).ctx("decoding the birthday tree state")?;
    let birthday = AccountBirthday::from_treestate(treestate, None).ctx("reading the birthday")?;
    let height = u32::from(birthday.height());
    let (_, _usk) = state.db.create_account("mitoshi", &seed, &birthday, None).ctx("creating the account")?;
    Ok(json!({ "birthday": height }))
}

pub fn seed_from(args: &Value) -> Result<SecretVec<u8>, Error> {
    let hex_seed = args.get("seed").and_then(Value::as_str).ok_or_else(|| Error::msg("missing seed"))?;
    let bytes = hex::decode(hex_seed).ctx("seed is not hex")?;
    if bytes.len() < 32 {
        return Err(Error::msg("seed is too short"));
    }
    Ok(SecretVec::new(bytes))
}

/// A never-used address with only an Orchard receiver: no transparent receiver to leak, and
/// funds sent to it land in the current shielded pool (Ironwood since NU6.3).
pub fn fresh_address(state: &mut State) -> Result<Value, Error> {
    let account = account_id(&state.db)?;
    let (ua, index) = state
        .db
        .get_next_available_address(account, UnifiedAddressRequest::ORCHARD)
        .ctx("deriving an address")?
        .ok_or_else(|| Error::msg("no further addresses available"))?;
    Ok(json!({
        "address": ua.encode(&state.network),
        "diversifierIndex": hex::encode(index.as_bytes()),
    }))
}

fn balance_json(b: &Balance) -> Value {
    json!({
        "spendable": b.spendable_value().into_u64(),
        "pendingChange": b.change_pending_confirmation().into_u64(),
        "pendingSpendable": b.value_pending_spendability().into_u64(),
        "locked": b.locked_value().into_u64(),
    })
}

fn account_json(b: &AccountBalance) -> Value {
    json!({
        "ironwood": balance_json(b.ironwood_balance()),
        "orchard": balance_json(b.orchard_balance()),
        "sapling": balance_json(b.sapling_balance()),
        "total": b.total().into_u64(),
    })
}

/// Balance and sync progress for the UI.
pub fn summary(state: &mut State) -> Result<Value, Error> {
    let tip = state.db.chain_height().ctx("reading the chain tip")?.map(u32::from);
    let scanned = state.db.block_fully_scanned().ctx("reading scan progress")?.map(|m| u32::from(m.block_height()));
    let birthday = state.db.get_wallet_birthday().ctx("reading the birthday")?.map(u32::from);
    let Some(summary) = state.db.get_wallet_summary(ConfirmationsPolicy::default()).ctx("reading the balance")? else {
        return Ok(json!({ "tip": tip, "scanned": scanned, "birthday": birthday, "balance": null }));
    };
    let progress = summary.progress().scan();
    let balance = summary.account_balances().values().next().map(account_json);
    Ok(json!({
        "tip": tip,
        "scanned": scanned,
        "birthday": birthday,
        "fullyScanned": u32::from(summary.fully_scanned_height()),
        "progress": { "done": progress.numerator(), "total": progress.denominator() },
        "balance": balance,
    }))
}

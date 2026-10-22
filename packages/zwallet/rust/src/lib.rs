//! Mitoshi's browser Zcash wallet core.
//!
//! Zcash's official SQLite wallet store (`zcash_client_sqlite`) compiled to `wasm32-wasip1` and run
//! in a Web Worker through a WASI shim. The database file lives at [`DB_PATH`] in the shim's
//! in-memory file system; the JS worker persists it (encrypted) after every mutating call.
//! JS owns every network request and hands this module raw lightwalletd protobuf bytes.

mod abi;
mod prover;
mod send;
mod sync;
mod wallet;

use std::cell::RefCell;
use std::fmt;

use rand::{rand_core::UnwrapErr, rngs::SysRng};
use serde_json::Value;
use zcash_client_sqlite::{WalletDb, util::SystemClock};
use zcash_protocol::consensus::{Network, NetworkUpgrade, Parameters};

/// Where the wallet database lives inside the WASI file system.
pub const DB_PATH: &str = "/data/wallet.sqlite";

pub type Db = WalletDb<rusqlite::Connection, Network, SystemClock, UnwrapErr<SysRng>>;

/// A plain error message for the JS side.
#[derive(Debug)]
pub struct Error(String);

impl Error {
    pub fn msg(m: impl Into<String>) -> Self {
        Error(m.into())
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// Adds a short context label to any error.
pub trait Ctx<T> {
    fn ctx(self, what: &str) -> Result<T, Error>;
}

impl<T, E: fmt::Debug> Ctx<T> for Result<T, E> {
    fn ctx(self, what: &str) -> Result<T, Error> {
        self.map_err(|e| Error(format!("{what}: {e:?}")))
    }
}

pub(crate) struct State {
    pub network: Network,
    pub db: Db,
}

thread_local! {
    static STATE: RefCell<Option<State>> = const { RefCell::new(None) };
}

/// Runs `f` with the open wallet.
pub(crate) fn with_state<T>(f: impl FnOnce(&mut State) -> Result<T, Error>) -> Result<T, Error> {
    STATE.with(|s| match s.borrow_mut().as_mut() {
        Some(state) => f(state),
        None => Err(Error::msg("wallet is not open; call init first")),
    })
}

fn network(args: &Value) -> Result<Network, Error> {
    match args.get("network").and_then(Value::as_str) {
        Some("main") => Ok(Network::MainNetwork),
        Some("test") => Ok(Network::TestNetwork),
        _ => Err(Error::msg("network must be \"main\" or \"test\"")),
    }
}

/// Opens (and migrates) the wallet database at [`DB_PATH`].
fn init(args: &Value) -> Result<Value, Error> {
    let network = network(args)?;
    let db = wallet::open(network)?;
    let nu7 = network.activation_height(NetworkUpgrade::Nu7).map(u32::from);
    STATE.with(|s| *s.borrow_mut() = Some(State { network, db }));
    Ok(serde_json::json!({ "nu7Height": nu7 }))
}

pub(crate) fn dispatch(method: &str, args: &Value, bin: &[u8]) -> Result<Value, Error> {
    match method {
        "init" => init(args),
        "warmProver" => prover::warm(),
        "createAccount" => with_state(|s| wallet::create_account(s, args, bin)),
        "hasAccount" => with_state(wallet::has_account),
        "freshAddress" => with_state(wallet::fresh_address),
        "summary" => with_state(wallet::summary),
        "updateTip" => with_state(|s| sync::update_tip(s, args)),
        "scanRanges" => with_state(sync::scan_ranges),
        "putSubtreeRoots" => with_state(|s| sync::put_subtree_roots(s, args, bin)),
        "scanBlocks" => with_state(|s| sync::scan_blocks(s, args, bin)),
        "propose" => with_state(|s| send::propose(s, args)),
        "build" => with_state(|s| send::build(s, args)),
        other => Err(Error::msg(format!("unknown method {other}"))),
    }
}

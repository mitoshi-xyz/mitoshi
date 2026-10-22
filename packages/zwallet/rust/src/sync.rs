//! Syncing: the JS worker fetches lightwalletd data and passes the raw protobuf bytes here.
//!
//! Loop (driven from JS): `updateTip` → `scanRanges` → for each range, fetch the tree state of the
//! block before it plus its compact blocks → `scanBlocks`. Subtree roots are put first so the
//! wallet can make spendable notes witnessable without scanning the whole chain.

use std::convert::Infallible;

use orchard::tree::MerkleHashOrchard;
use prost::Message as _;
use serde_json::{Value, json};
use zcash_client_backend::{
    data_api::{WalletCommitmentTrees, WalletRead, WalletWrite, chain::CommitmentTreeRoot},
    proto::{
        compact_formats::CompactBlock,
        service::{SubtreeRoot, TreeState},
    },
    scanning::{ScanBlockError, ScanningKeys, SpendIdentifiers, scan_block},
};
use zcash_primitives::merkle_tree::HashSer;
use zcash_protocol::consensus::BlockHeight;

use crate::{Ctx, Error, State, abi::frames};

/// How far below a broken link to rewind: the depth `zcash_client_backend::sync` uses.
const REORG_REWIND_BLOCKS: u32 = 10;

fn height_arg(args: &Value, key: &str) -> Result<BlockHeight, Error> {
    args.get(key)
        .and_then(Value::as_u64)
        .and_then(|h| u32::try_from(h).ok())
        .map(BlockHeight::from_u32)
        .ok_or_else(|| Error::msg(format!("missing {key}")))
}

pub fn update_tip(state: &mut State, args: &Value) -> Result<Value, Error> {
    let tip = height_arg(args, "height")?;
    state.db.update_chain_tip(tip).ctx("updating the chain tip")?;
    Ok(json!(u32::from(tip)))
}

/// The ranges still to scan, most urgent first, as `{start, end, priority}` (end exclusive).
pub fn scan_ranges(state: &mut State) -> Result<Value, Error> {
    let ranges = state.db.suggest_scan_ranges().ctx("suggesting scan ranges")?;
    Ok(Value::Array(
        ranges
            .iter()
            .map(|r| {
                json!({
                    "start": u32::from(r.block_range().start),
                    "end": u32::from(r.block_range().end),
                    "priority": format!("{:?}", r.priority()),
                })
            })
            .collect(),
    ))
}

fn roots<H: HashSer>(bin: &[u8]) -> Result<Vec<CommitmentTreeRoot<H>>, Error> {
    frames(bin)?
        .into_iter()
        .map(|frame| {
            let root = SubtreeRoot::decode(frame).ctx("decoding a subtree root")?;
            let height = u32::try_from(root.completing_block_height).ctx("subtree root height")?;
            let hash = H::read(&root.root_hash[..]).ctx("reading a subtree root hash")?;
            Ok(CommitmentTreeRoot::from_parts(BlockHeight::from_u32(height), hash))
        })
        .collect()
}

/// Puts subtree roots for one pool: `{protocol: "sapling" | "orchard" | "ironwood", startIndex}`,
/// binary payload = framed lightwalletd `SubtreeRoot` messages.
pub fn put_subtree_roots(state: &mut State, args: &Value, bin: &[u8]) -> Result<Value, Error> {
    let start = args.get("startIndex").and_then(Value::as_u64).unwrap_or(0);
    let protocol = args.get("protocol").and_then(Value::as_str).unwrap_or_default();
    let count = match protocol {
        "sapling" => {
            let r = roots::<sapling::Node>(bin)?;
            state.db.put_sapling_subtree_roots(start, &r).ctx("putting sapling roots")?;
            r.len()
        }
        "orchard" => {
            let r = roots::<MerkleHashOrchard>(bin)?;
            state.db.put_orchard_subtree_roots(start, &r).ctx("putting orchard roots")?;
            r.len()
        }
        // Ironwood note commitments are Orchard-shaped.
        "ironwood" => {
            let r = roots::<MerkleHashOrchard>(bin)?;
            state.db.put_ironwood_subtree_roots(start, &r).ctx("putting ironwood roots")?;
            r.len()
        }
        other => return Err(Error::msg(format!("unknown protocol {other}"))),
    };
    Ok(json!(count))
}

/// Scans one batch: `{fromHeight}`; binary payload = framed messages, the first a `TreeState`
/// for `fromHeight - 1`, the rest the `CompactBlock`s from `fromHeight` upward.
///
/// This is `scan_cached_blocks` without its batch runners: those hand trial decryption to a
/// rayon pool, and WASI has no threads (the pool never runs, and the scan spins forever).
/// `scan_block` decrypts inline, block by block, with the same keys and spend identifiers.
///
/// A chain reorg shows up as a continuity error (a block whose parent is not the block we stored).
/// Then nothing from the batch is stored, the wallet is truncated a few blocks below the break (as
/// `zcash_client_backend::sync` does), and `{reorg: {at, rewoundTo}}` is returned so the caller
/// asks for fresh scan ranges and carries on.
pub fn scan_blocks(state: &mut State, args: &Value, bin: &[u8]) -> Result<Value, Error> {
    let from = height_arg(args, "fromHeight")?;
    let messages = frames(bin)?;
    let (first, rest) = messages.split_first().ok_or_else(|| Error::msg("empty scan batch"))?;
    let prior = TreeState::decode(*first)
        .ctx("decoding the prior tree state")?
        .to_chain_state()
        .ctx("reading the prior chain state")?;
    if prior.block_height() + 1 != from {
        return Err(Error::msg("the tree state must be for the block before fromHeight"));
    }
    let network = state.network;
    let keys = ScanningKeys::from_account_ufvks(state.db.get_unified_full_viewing_keys().ctx("reading viewing keys")?);
    let mut spend_ids = SpendIdentifiers::unspent(&state.db).ctx("reading unspent notes")?;
    let mut prior_meta = state.db.block_metadata(from - 1).ctx("reading the prior block")?;
    let (mut received, mut spent) = (0usize, 0usize);
    let mut scanned = Vec::with_capacity(rest.len());
    let mut end = from;
    for message in rest {
        let block = CompactBlock::decode(*message).ctx("decoding a compact block")?;
        end = block.height() + 1;
        let block = match scan_block::<_, _, _, Infallible>(&network, block, &keys, &spend_ids, prior_meta.as_ref()) {
            Ok(block) => block,
            Err(ScanBlockError::Scan(e)) if e.is_continuity_error() => {
                let rewound = state
                    .db
                    .truncate_to_height(e.at_height().saturating_sub(REORG_REWIND_BLOCKS))
                    .ctx("rewinding after a chain reorg")?;
                return Ok(json!({
                    "reorg": { "at": u32::from(e.at_height()), "rewoundTo": u32::from(rewound) },
                }));
            }
            Err(e) => return Err(Error::msg(format!("scanning block: {e:?}"))),
        };
        for tx in block.transactions() {
            received += tx.sapling_outputs().len() + tx.orchard_outputs().len() + tx.ironwood_outputs().len();
            spent += tx.sapling_spends().len() + tx.orchard_spends().len() + tx.ironwood_spends().len();
        }
        spend_ids.update_with(&block);
        prior_meta = Some(block.to_block_metadata());
        scanned.push(block);
    }
    state.db.put_blocks(&prior, scanned).ctx("storing scanned blocks")?;
    Ok(json!({
        "scanned": { "start": u32::from(from), "end": u32::from(end) },
        "received": received,
        "spent": spent,
    }))
}

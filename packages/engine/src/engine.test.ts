import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  CROSSING_FEE_ZAT,
  LADDER_ZAT,
  REST_MAX_MS,
  REST_MIN_MS,
  TRANSFER_DELAY_CAP_MS,
  UNKNOWN_ORIGIN_HOLD_BLOCKS,
} from "./constants.ts";
import { decompose, fundableSizes, isCanonical } from "./denominations.ts";
import { evmAddress, evmKey, slip10, solanaKey, throwawayAddress, walletAddress, walletPath } from "./keys.ts";
import { checkFunding, checkWithdrawal } from "./leak.ts";
import { canonicalParts, migrationParts, migrationSchedule, transferDelay } from "./migration.ts";
import { advance, emptyRegistry, type PrivateWallet, positionWallet } from "./registry.ts";
import { planRest, restBlocks, restKey } from "./rest.ts";
import { fundingTime, refillTime, retimed } from "./schedule.ts";

const ZEC = 100_000_000;

describe("standard amounts", () => {
  it("knows the ladder", () => {
    assert.equal(LADDER_ZAT.length, 8);
    assert.ok(isCanonical(0.005 * ZEC));
    assert.ok(isCanonical(0.05 * ZEC));
    assert.ok(!isCanonical(0.03 * ZEC));
  });
  it("offers only sizes the balance covers with the fee", () => {
    assert.deepEqual(fundableSizes(0.06 * ZEC, 10_000), [0.005 * ZEC, 0.01 * ZEC, 0.02 * ZEC, 0.05 * ZEC]);
    assert.deepEqual(fundableSizes(0.05 * ZEC, 10_000), [0.005 * ZEC, 0.01 * ZEC, 0.02 * ZEC]);
    assert.deepEqual(fundableSizes(0.0052 * ZEC, 15_000), [0.005 * ZEC]);
  });
  it("splits odd amounts into standard pieces", () => {
    assert.deepEqual(decompose(0.35 * ZEC), { pieces: [0.2 * ZEC, 0.1 * ZEC, 0.05 * ZEC], leftover: 0 });
    assert.deepEqual(decompose(2.013 * ZEC), { pieces: [ZEC, ZEC, 0.01 * ZEC], leftover: 0.003 * ZEC });
  });
});

describe("rest rules", () => {
  const key = restKey(new Uint8Array(64).fill(7));
  const ref = { txid: "ab".repeat(32), pool: "ironwood" as const, index: 0 };
  it("rests 2 to 6 hours, the same every time for the same note", () => {
    const b = restBlocks(key, ref, 75);
    assert.equal(b, restBlocks(key, ref, 75));
    assert.ok(b >= REST_MIN_MS / 75_000 && b <= Math.ceil(REST_MAX_MS / 75_000), `got ${b}`);
    const others = Array.from({ length: 50 }, (_, i) => restBlocks(key, { ...ref, index: i }, 75));
    assert.ok(new Set(others).size > 10, "rest lengths vary between notes");
  });
  it("locks public value from its mined height, holds unknown value, frees shielded value", () => {
    const tip = 1000;
    const plan = planRest(
      [
        { ...ref, minedHeight: 990, origin: "public" },
        { ...ref, index: 1, minedHeight: 995, origin: "unknown" },
        { ...ref, index: 2, minedHeight: 995, origin: "shielded" },
        { ...ref, index: 3, minedHeight: 10, origin: "public" },
        { ...ref, index: 4, minedHeight: null, origin: "public" },
      ],
      tip,
      key,
      75,
    );
    const heights = Object.fromEntries(plan.lock.flatMap((l) => l.notes.map((n) => [n.index, l.untilHeight])));
    assert.equal(heights[0], 990 + restBlocks(key, ref, 75));
    assert.equal(heights[1], tip + UNKNOWN_ORIGIN_HOLD_BLOCKS);
    assert.equal(heights[3], undefined, "a note that already rested stays free");
    assert.equal(heights[4], undefined, "an unmined note is not locked yet");
    assert.deepEqual(
      plan.unlock.map((n) => n.index),
      [2],
    );
  });
});

describe("timing", () => {
  it("never funds at once", () => {
    assert.equal(
      fundingTime(0, () => 0),
      20_000,
    );
    assert.equal(
      fundingTime(0, () => 1),
      180_000,
    );
  });
});

describe("refill timing", () => {
  it("waits at least 20 s and at most 12 h", () => {
    assert.equal(
      refillTime(0, () => 0),
      20_000,
    );
    assert.equal(
      refillTime(0, () => 0.999_999_999),
      12 * 3_600_000,
    );
  });
  it("is exponential with a 90-minute mean", () => {
    // The median of an exponential is mean × ln 2.
    assert.equal(
      refillTime(0, () => 0.5),
      Math.round(90 * 60_000 * Math.LN2),
    );
  });
  it("retimes an overdue funding from now, by its kind", () => {
    assert.equal(
      retimed(1_000, false, () => 0),
      21_000,
    );
    assert.equal(
      retimed(1_000, true, () => 0.5),
      1_000 + Math.round(90 * 60_000 * Math.LN2),
    );
  });
});

describe("registry", () => {
  const w: PrivateWallet = {
    id: "w1",
    venue: "hyperliquid",
    index: 0,
    address: "0x",
    sizeZat: 0.05 * ZEC,
    status: "preparing",
    createdAt: 0,
    timeline: [{ status: "preparing", at: 0 }],
    swaps: [],
  };
  it("follows the wallet's life", () => {
    let x = advance(w, "funding", 1);
    x = advance(x, "ready", 2);
    x = advance(x, "trading", 3);
    x = advance(x, "returning", 4);
    x = advance(x, "retired", 5);
    assert.deepEqual(
      x.timeline.map((e) => e.status),
      ["preparing", "funding", "ready", "trading", "returning", "retired"],
    );
  });
  it("refuses moves the flow never makes", () => {
    assert.throws(() => advance(w, "trading", 1));
    assert.throws(() => advance(advance(advance(w, "funding", 1), "refunded", 2), "ready", 3));
  });
  it("starts empty", () => {
    assert.deepEqual(emptyRegistry().nextIndex, { polymarket: 0, hyperliquid: 0, solana: 0 });
  });
});

describe("one wallet per position", () => {
  const trade = (asset: string) => ({
    at: 1,
    label: asset,
    asset,
    side: "buy" as const,
    inAmount: "1",
    outAmount: "1",
    usd: 1,
  });
  const wallet = (id: string, status: PrivateWallet["status"], assets: string[] = []): PrivateWallet => ({
    id,
    venue: "hyperliquid",
    index: 0,
    address: id,
    sizeZat: 0.01 * ZEC,
    status,
    createdAt: 0,
    timeline: [],
    swaps: [],
    trades: assets.map(trade),
  });
  const registry = (...wallets: PrivateWallet[]) => ({ ...emptyRegistry(), wallets });
  it("keeps a market on the wallet that already trades it", () => {
    const r = registry(wallet("a", "trading", ["BTC"]), wallet("b", "ready"));
    assert.deepEqual(positionWallet(r, "hyperliquid", "BTC"), { wallet: r.wallets[0], holds: true });
  });
  it("opens another market from a ready wallet, never from another position's", () => {
    const r = registry(wallet("a", "trading", ["BTC"]), wallet("b", "ready"));
    assert.equal(positionWallet(r, "hyperliquid", "ETH").wallet?.id, "b");
  });
  it("asks for a new wallet when none is ready", () => {
    const r = registry(wallet("a", "trading", ["BTC"]));
    assert.deepEqual(positionWallet(r, "hyperliquid", "ETH"), { wallet: undefined, holds: false });
  });
  it("skips wallets the venue cannot use", () => {
    const r = registry(wallet("b", "ready"));
    assert.equal(positionWallet(r, "hyperliquid", "ETH", (w) => w.id !== "b").wallet, undefined);
  });
});

describe("keys", () => {
  it("gives previews a fresh well-formed address that is never a wallet's", () => {
    const seed = hexToBytes("000102030405060708090a0b0c0d0e0f");
    const evm = throwawayAddress("hyperliquid");
    assert.match(evm, /^0x[0-9a-fA-F]{40}$/);
    assert.notEqual(evm, throwawayAddress("hyperliquid"));
    assert.notEqual(evm, walletAddress(seed, "hyperliquid", 0));
    assert.match(throwawayAddress("solana"), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });
  it("matches SLIP-0010 ed25519 test vector 1", () => {
    const seed = hexToBytes("000102030405060708090a0b0c0d0e0f");
    assert.equal(bytesToHex(slip10(seed, "m/0'")), "68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3");
    assert.equal(
      bytesToHex(slip10(seed, "m/0'/1'/2'/2'/1000000000'")),
      "8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793",
    );
  });
  it("derives EIP-55 addresses", () => {
    const pk = hexToBytes("4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318");
    assert.equal(evmAddress(pk), "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23");
  });
  it("gives every wallet its own hardened path and key", () => {
    assert.equal(walletPath("hyperliquid", 3), "m/44'/60'/6874'/1'/3'");
    assert.equal(walletPath("solana", 0), "m/44'/501'/6874'/2'/0'");
    const seed = new Uint8Array(64).fill(1);
    const a = evmKey(seed, "hyperliquid", 0).address;
    const b = evmKey(seed, "hyperliquid", 1).address;
    const c = evmKey(seed, "polymarket", 0).address;
    assert.equal(new Set([a, b, c]).size, 3);
    assert.match(solanaKey(seed, 0).address, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });
});

describe("leak meter", () => {
  it("passes a standard funding and refuses resting value", () => {
    assert.equal(
      checkFunding({ amountZat: 0.05 * ZEC, feeZat: 10_000, spendableZat: ZEC, restingZat: 0 }).level,
      "green",
    );
    assert.equal(
      checkFunding({ amountZat: 0.03 * ZEC, feeZat: 10_000, spendableZat: ZEC, restingZat: 0 }).level,
      "red",
    );
    const resting = checkFunding({
      amountZat: 0.05 * ZEC,
      feeZat: 10_000,
      spendableZat: 0.01 * ZEC,
      restingZat: 0.1 * ZEC,
    });
    assert.equal(resting.level, "red");
    assert.ok(resting.reasons.some((r) => r.text.includes("resting")));
  });
  it("flags a public withdrawal that matches a payout", () => {
    const now = 10 * 3600_000;
    const payouts = [{ zat: 4_012_345, at: now - 3 * 3600_000 }];
    assert.equal(checkWithdrawal({ amountZat: 4_012_345, shielded: false, now, payouts }).level, "red");
    assert.equal(checkWithdrawal({ amountZat: 4_000_000, shielded: false, now, payouts }).level, "amber");
    assert.equal(checkWithdrawal({ amountZat: 4_012_345, shielded: true, now, payouts }).level, "green");
    assert.equal(checkWithdrawal({ amountZat: 0.5 * ZEC, shielded: false, now, payouts }).level, "green");
  });
});

describe("ZIP 318 migration", () => {
  it("splits like the ZIP's digit expansion", () => {
    // ZIP 318's own example: 123.45 ZEC → [100, 20, 2, 1, 0.2, 0.2, 0.05].
    assert.deepEqual(
      canonicalParts(12_345_000_000).map((z) => z / ZEC),
      [100, 20, 2, 1, 0.2, 0.2, 0.05],
    );
    assert.deepEqual(canonicalParts(999_999), [], "under 0.01 ZEC is the residual");
  });

  it("gives every part one note and its own fee", () => {
    const { parts, residual } = migrationParts([0.35 * ZEC + 3 * CROSSING_FEE_ZAT]);
    assert.deepEqual(parts, [0.2 * ZEC, 0.1 * ZEC, 0.05 * ZEC]);
    assert.equal(residual, 0);
    const tiny = migrationParts([0.01 * ZEC]);
    assert.deepEqual(tiny.parts, [], "0.01 ZEC can't also pay its fee");
    assert.equal(tiny.residual, 0.01 * ZEC);
  });

  it("shuffles the parts and spaces them by capped exponential delays", () => {
    let i = 0;
    const seq = [0.9, 0.1, 0.5, 0.999_999_999, 0.2];
    const rand = () => seq[i++ % seq.length] as number;
    const plan = migrationSchedule([1, 2, 3], 0, rand);
    assert.equal(plan.length, 3);
    assert.deepEqual(plan.map((p) => p.zat).sort(), [1, 2, 3]);
    for (let k = 1; k < plan.length; k++) assert.ok((plan[k]?.at ?? 0) > (plan[k - 1]?.at ?? 0));
    assert.equal(
      transferDelay(() => 0.999_999_999),
      TRANSFER_DELAY_CAP_MS,
    );
  });
});

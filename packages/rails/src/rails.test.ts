import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatUnits, quoteRequest } from "./oneclick.ts";
import { stableStringify, verifyQuote } from "./signature.ts";
import type { QuoteResponse } from "./types.ts";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/dry-quote.json", import.meta.url), "utf8"),
) as QuoteResponse;

describe("1Click quote signatures", () => {
  it("accepts a real signed quote", () => {
    assert.ok(verifyQuote(fixture));
  });
  it("rejects any change to what was signed", () => {
    const moreOut = structuredClone(fixture);
    moreOut.quote.amountOut = `${BigInt(moreOut.quote.amountOut) + 1n}`;
    assert.ok(!verifyQuote(moreOut));
    const otherRecipient = structuredClone(fixture);
    otherRecipient.quoteRequest.recipient = "0x000000000000000000000000000000000000beef";
    assert.ok(!verifyQuote(otherRecipient));
    const otherRefund = structuredClone(fixture);
    otherRefund.quoteRequest.refundTo = "u1other";
    assert.ok(!verifyQuote(otherRefund));
  });
  it("rejects another key", () => {
    assert.ok(!verifyQuote(fixture, "ed25519:11111111111111111111111111111111"));
  });
});

describe("quote requests", () => {
  it("asks for an exact-input swap with a shielded refund", () => {
    const r = quoteRequest({
      from: "zec",
      to: "hypercoreUsdc",
      amount: "5000000",
      recipient: "0xabc",
      refundTo: "u1abc",
      dry: false,
      appFee: true,
      now: 0,
    });
    assert.equal(r.swapType, "EXACT_INPUT");
    assert.equal(r.originAsset, "nep141:zec.omft.near");
    assert.equal(r.refundTo, "u1abc");
    assert.equal(r.deadline, "1970-01-01T02:00:00.000Z");
    assert.equal(r.appFees, undefined, "no fee without a named recipient");
    assert.equal(r.confidentiality, undefined);
  });

  it("takes whatever arrives for a flexible trip home, never in confidential mode", () => {
    const r = quoteRequest({
      from: "polygonUsdc",
      to: "zec",
      amount: "9990000",
      recipient: "u1home",
      refundTo: "0xwallet",
      dry: false,
      appFee: false,
      flexible: true,
      confidentiality: "basic",
      now: 0,
    });
    assert.equal(r.swapType, "FLEX_INPUT");
    assert.equal(r.confidentiality, undefined, "1Click has no confidential mode for FLEX_INPUT");
  });
});

describe("helpers", () => {
  it("sorts keys like json-stable-stringify", () => {
    assert.equal(stableStringify({ b: 1, a: { d: undefined, c: [1, undefined] } }), '{"a":{"c":[1,null]},"b":1}');
  });
  it("formats base units", () => {
    assert.equal(formatUnits("5000000", 8), "0.05");
    assert.equal(formatUnits("6028028700", 8), "60.280287");
    assert.equal(formatUnits("100000000", 8), "1");
  });
});

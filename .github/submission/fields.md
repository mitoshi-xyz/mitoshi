# ZECATHON submission fields

Ready to paste into the form at thezecathon.com (SUBMIT PROJECT), in the form's order. Limits are the form's own (forms.js, re-checked 2026-10-23).

| Field | Limit | Value |
| --- | --- | --- |
| Project name | 64 | Mitoshi 見通し |
| Track | one | Private Markets |
| Description | 2000 | below (1,923 characters) |
| Code repository | URL | https://github.com/mitoshi-xyz/mitoshi |
| Working demo | URL | https://mitoshi.xyz |
| Demo video | URL | (the two-minute recording, once uploaded) |
| Public repo | checkbox | tick it on every submit (it is not carried over from a draft) |

## Description

```text
Trade predictions, stocks and crypto from shielded ZEC. On Polymarket, Hyperliquid and Solana, each position opens from a brand-new wallet funded through NEAR Intents: copy traders find one trade and no history. Live at mitoshi.xyz.

What it does: a real Zcash wallet runs in your browser (librustzcash's zcash_client_sqlite and client_backend compiled to WASM; Ironwood and Orchard, NU7-ready). For each position on Polymarket, Polymarket Perps (US stocks, gold, oil), Hyperliquid or Solana, Mitoshi derives a fresh key and funds it from the shielded pool through NEAR Intents 1Click. The order goes to the venue's real book. Send home swaps the money back to a fresh shielded address.

Why it does not leak:
- One wallet, one position: no two wallets share a key, proxy, refund address or request.
- ZIP 318 canonical amounts (0.01, 0.02, 0.05… ZEC) at sampled random times: never at a deposit, at app open or right after a trade. Value from a public address rests 2-6 h.
- Confidential NEAR swaps (all but Polymarket's trip home), a fresh shielded refund address for each funding.
- Every call about your wallets is Oblivious HTTP over two hops: the relay sees your IP, not the request; the gateway (Dublin) sees the request, not your IP. Light-client calls too.
- No server holds keys, wallets or positions. Pages and workers load nothing third-party (strict CSP, no-transform). No builder tag on orders.
- A leak meter on every send; "What the public sees" shows each wallet as a copy trader would.

What is real: the browser wallet proved and broadcast Ironwood spends on NU7 testnet (txids in the README); production runs on mainnet with live venue data; confidential 1Click quotes and Polymarket's builder signing verified through the gateway; 37 unit tests. Not yet: the full mainnet round trip on each venue.
Mock: none in the product. The landing's copy-trader feed and sample wallets are labelled illustrations.
```

# ZECATHON submission fields

Ready to paste into the form at thezecathon.com (SUBMIT PROJECT), in the form's order. Limits are the form's own (forms.js, re-checked 2026-10-23; the event data unchanged on 2026-10-24). The form has no
separate problem field, so the problem opens the Description in the README's words.

| Field | Limit | Value |
| --- | --- | --- |
| Project name | 64 | Mitoshi 見通し |
| Track | one | Private Markets |
| Description | 2000 | below (1,995 characters) |
| Code repository | URL | https://github.com/mitoshi-xyz/mitoshi |
| Working demo | URL | The judges' link (`https://judge.mitoshi.xyz/#k=…`): the owner holds it; the key never goes in this repository |
| Demo video | URL | (the two-minute recording, once uploaded) |
| Public repo | checkbox | tick it on every submit (it is not carried over from a draft) |

## Description

```text
Trade predictions, stocks and crypto from shielded ZEC. Every trade on Polymarket, Hyperliquid or Solana gets a brand-new wallet, funded privately through NEAR Intents. The trade is public; who made it isn't.

The problem: on these markets every trade is public, and tools rank wallets so others can copy them. Traders use a new wallet for every trade, but the money that funds it gives it away: a transfer from the main wallet is public, and an exchange records every withdrawal under your name. "I created another wallet to trade in peace and people found it."

What it does: a real Zcash wallet (librustzcash in WASM, Ironwood-ready) runs in your browser. For each position on Polymarket, Polymarket Perps (US stocks, gold, oil), Hyperliquid or Solana, Mitoshi derives a fresh key and funds it from the shielded pool through NEAR Intents. The order goes to the venue's real book. Send home swaps the money back to a fresh shielded address. No account, no fee.

Why it does not leak:
- One wallet per position: no two share a key, proxy, refund address or request.
- ZIP 318 standard amounts at random times: never at a deposit, at app open or right after a trade. ZEC from a public address rests 2-6 h.
- Confidential NEAR swaps (all but Polymarket's trip home).
- Every call about your wallets is Oblivious HTTP: the relay sees your IP, not the request; the gateway sees the request, not your IP.
- No server holds keys, wallets or positions; pages load nothing third-party; one pool per transaction.
- A leak meter on every send, and each wallet shown as a copy trader sees it.

What is real: live on Zcash mainnet with live venue data; a mainnet funding ran end to end (browser-proved Ironwood spend, NEAR swap, trading on Hyperliquid in 14 min); Polymarket builder signing verified; 40 unit tests. Not yet: a mainnet trade and trip home.
Mock: none; the landing's sample wallets are labelled illustrations.

Judges: the Working demo link opens a funded wallet. Trade BTC in 30 seconds.
```

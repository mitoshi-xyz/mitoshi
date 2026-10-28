# ZECATHON submission fields

Ready to paste into the form at thezecathon.com (SUBMIT PROJECT), in the form's order. Limits are the form's own (forms.js, re-checked 2026-10-23; the event data unchanged on 2026-10-24). The form has no
separate problem field, so the problem opens the Description in the README's words.

| Field | Limit | Value |
| --- | --- | --- |
| Project name | 64 | Mitoshi 見通し |
| Track | one | Private Markets |
| Description | 2000 | below (1,984 characters) |
| Code repository | URL | https://github.com/mitoshi-xyz/mitoshi |
| Working demo | URL | The judges' short link (`https://mitoshi.xyz/j/…`, the one in the video's QR), which forwards to `https://judge.mitoshi.xyz/#k=…`; the owner holds it, and neither the code nor the key goes in this repository |
| Demo video | URL | https://youtu.be/Ll-X6zQsO6Q |
| Public repo | checkbox | tick it on every submit (it is not carried over from a draft) |

## Description

```text
Trade Polymarket, Hyperliquid and Solana privately, from shielded ZEC: every trade gets a brand-new wallet, funded through NEAR Intents, with no history to follow.

The problem: on these markets every trade is public, and tools rank wallets so others can copy them. Traders use a new wallet for every trade, but the money that funds it gives it away: a transfer from the main wallet is public, and an exchange records every withdrawal under your name. In 2024 the "Trump whale" bet $30M+ through four anonymous Polymarket accounts; Chainalysis linked 11 accounts to him.

What it does: a real Zcash wallet (librustzcash in WASM) runs in your browser. For each position on Polymarket, Polymarket Perps (US stocks, gold, oil), Hyperliquid or Solana, Mitoshi derives a fresh key and funds it from the shielded pool through NEAR Intents. The order goes to the venue's real book. Send home swaps the money back to a fresh shielded address. No account, no fee.

Why it does not leak:
- One wallet per position: no two share a key, proxy, refund address or request.
- ZIP 318 standard amounts at random times, never at a deposit, app open or right after a trade.
- Confidential NEAR swaps (all but Polymarket's trip home).
- Every call about your wallets is Oblivious HTTP: the relay sees your IP, not the request; the gateway sees the request, not your IP.
- No server holds keys, wallets or positions; the app loads nothing third-party.
- A leak meter on every send, and each wallet shown as a copy trader sees it.

What is real: live on Zcash mainnet with live venue data. On 2026-10-28 a full mainnet round trip ran: shielded ZEC to a fresh Hyperliquid wallet, a BTC long, closed, and sent home as shielded ZEC, with the trade and the trip home on their explorers (in the video). 42 unit tests. Mock: none; sample wallets are labelled.

Judges: the Working demo link opens a funded wallet. Trade BTC in 30 seconds.
Live: mitoshi.xyz · Docs: docs.mitoshi.xyz · Video: youtu.be/Ll-X6zQsO6Q
```

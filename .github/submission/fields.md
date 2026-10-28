# ZECATHON submission fields

Ready to paste into the form at thezecathon.com (SUBMIT PROJECT), in the form's order. Limits are the form's own (forms.js, re-checked 2026-10-23; the event data unchanged on 2026-10-24). The form has no
separate problem field, so one line of problem opens the Description.

| Field | Limit | Value |
| --- | --- | --- |
| Project name | 64 | Mitoshi 見通し |
| Track | one | Private Markets |
| Description | 2000 | below (1,541 characters, in the form's four parts: what it does, why it does not leak, what is real, what is a mock) |
| Code repository | URL | https://github.com/mitoshi-xyz/mitoshi |
| Working demo | URL | The judges' short link (`https://mitoshi.xyz/j/…`, the one in the video's QR), which forwards to `https://judge.mitoshi.xyz/#k=…`; the owner holds it, and neither the code nor the key goes in this repository |
| Demo video | URL | https://youtu.be/Ll-X6zQsO6Q |
| Public repo | checkbox | tick it on every submit (it is not carried over from a draft) |

## Description

```text
Trade Polymarket, Hyperliquid and Solana privately, from shielded ZEC. On these venues every wallet is public, so traders get copied and traced: the 2024 "Trump whale" used four anonymous Polymarket accounts, and Chainalysis still linked 11 to him.

What it does
A real Zcash wallet (librustzcash in WASM) runs in your browser. For every position on Polymarket, Polymarket Perps (stocks, gold, oil), Hyperliquid or Solana, Mitoshi creates a brand-new wallet and funds it from the shielded pool through NEAR Intents. Orders go to each venue's real book. Send home swaps the money back to a fresh shielded address. No account, no sign-up, no fee.

Why it does not leak
- One wallet per position: no two share a key, proxy, refund address or request.
- Funding in ZIP 318 standard amounts at random times, never right after a deposit or a trade.
- Confidential NEAR swaps (all but Polymarket's trip home).
- Every call about your wallets goes over Oblivious HTTP: the relay sees your IP, not the request; the gateway sees the request, not your IP.
- No server holds your keys, wallets or positions.

What is real
Everything. Live on Zcash mainnet with live venue data. On 2026-10-28 a full round trip ran on mainnet: shielded ZEC to a fresh Hyperliquid wallet, a BTC long, closed, and sent home as shielded ZEC. Both explorers are in the video.

What is a mock
Nothing. The sample wallets on the landing page are labelled as examples.

Judges: the Working demo link opens a funded wallet. Trade BTC in 30 seconds.
mitoshi.xyz · docs.mitoshi.xyz
```

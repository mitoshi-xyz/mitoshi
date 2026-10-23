# Mitoshi 見通し

**Trade privately from anywhere. Polymarket predictions, perps, US stocks, gold and Solana tokens from shielded ZEC, each trade from a wallet that has never existed before.**

Copy-traders watch every public wallet. Mitoshi keeps your money in Zcash's shielded pool, the largest privacy crowd in
crypto, and opens every position from a brand-new single-use wallet funded from that pool in standard amounts at random
times. When you close, the money goes home to a fresh shielded address. Watchers see wallets that make one trade and
vanish: no history, nothing to follow.

> Built for [ZECATHON](https://thezecathon.com), the Zcash privacy hackathon (Sep 28 – Oct 28, 2026).
> This is a **new product written during the build window**. It shares only the Mitoshi name and brand with the
> earlier, unrelated Mitoshi prediction market on Tempo; no code from that project is used. The git history of this
> repository starts on 2026-10-22.

## Status

Work in progress. See the build stages below; each one ships only when it works end to end on mainnet.

## How it works (short)

1. **Private balance**: a Zcash wallet runs in your browser (Ironwood shielded pool, NU7-ready). Keys never leave
   your device.
2. **Private wallets**: for each position Mitoshi derives a fresh key and funds it from the shielded pool through
   NEAR Intents 1Click, in ZIP 318 canonical amounts, at random times, so no deposit can be matched to you.
3. **Trade**: Polymarket (prediction markets), Hyperliquid (perps) and Solana (tokens), at each venue's real prices.
4. **Come home**: proceeds return to a fresh shielded address. Your portfolio across every venue lives only on your
   device.

## Built on

- **Zcash**: shielded Ironwood wallet in the browser; ZIP 32, 315, 317, 318.
- **NEAR Intents 1Click**: every rail in and out of the shielded pool.

## License

MIT

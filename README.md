<p align="center">
  <a href="https://mitoshi.xyz">
    <img src=".github/assets/banner.png" width="960" alt="Mitoshi 見通し. Trade privately from anywhere. Your balance stays shielded in Zcash. Every trade opens from a brand-new wallet nobody can link to you. Three phone screens from the app: a Polymarket event, the NVIDIA perps terminal and a Long order sheet." />
  </a>
</p>

<h1 align="center">Mitoshi · 見通し</h1>
<p align="center"><b>A new wallet for every trade.</b><br/>Trade Polymarket and Hyperliquid from shielded ZEC: each position opens from a brand-new wallet funded through NEAR Intents, so copy traders find one trade and no history.</p>

<p align="center">
  <a href="https://mitoshi.xyz"><b>Open Mitoshi</b></a>
  &nbsp;·&nbsp;
  <a href="https://mitoshi.xyz/demo"><b>Demo</b></a>
  &nbsp;·&nbsp;
  <a href="https://mitoshi.xyz/docs/how-it-works"><b>How it works</b></a>
  &nbsp;·&nbsp;
  <a href="https://mitoshi.xyz/privacy"><b>Who sees what</b></a>
  &nbsp;·&nbsp;
  <a href="https://mitoshi.xyz/status"><b>Service status</b></a>
  &nbsp;·&nbsp;
  <a href="https://mitoshi.xyz/docs"><b>Documentation</b></a>
</p>

**Mitoshi keeps your money in Zcash's shielded pool and opens every position from a brand-new, single-use wallet.**
Each wallet is funded from the pool through NEAR Intents at a standard amount and at a random moment, makes one trade on
the venue's real market, and sends the money home to a fresh shielded address when you close. Anyone watching the venue
sees a wallet with one trade and no history, and nothing that links it to your other wallets or to you.

Built for **[ZECATHON](https://thezecathon.com)**, the Zcash privacy hackathon (Sep 28 – Oct 28, 2026). *Mitoshi*
(見通し) means **outlook**: the view ahead. This is a **new product written during the build window**. It shares only
the Mitoshi name and brand with the earlier, unrelated Mitoshi prediction market on Tempo, and uses none of its code. The
git history of this repository starts on 2026-10-22. See [what is verified](#what-is-verified) for what has run end to
end and what is still waiting.

## Problem and value

### Problem

On a public venue your wallet is your track record. Win a few trades and copy-trading bots follow the address: they
mirror each entry, crowd the exit and trade ahead of your size. A new wallet does not help for long, because it is
found through the money that funds it. Privacy tools that exist today cover one venue each, or ask you to sign in and
trust a pool you cannot inspect.

### Value

Mitoshi gives the trader one private balance and many public venues:

| You want to | Mitoshi does | Start here |
| --- | --- | --- |
| **Bet on an outcome** | Polymarket events: probability chart, every outcome, Yes/No at the book's price, limit orders, redeem | [Predict](https://mitoshi.xyz/predict) |
| **Trade stocks, gold or oil** | Polymarket Perps: NVIDIA, indices, gold, oil, with leverage and TP/SL | [NVDA](https://mitoshi.xyz/trade#pm/NVDA-USD) |
| **Trade crypto perps** | Hyperliquid: live chart, long/short, leverage, TP/SL | [BTC](https://mitoshi.xyz/trade#BTC) |
| **Buy a token** | Solana tokens through Jupiter | [Tokens](https://mitoshi.xyz/tokens) |
| **Check what leaks** | The copy-trader's view of each wallet, and a leak meter on every send | [Privacy](https://mitoshi.xyz/privacy) |

There is no account and no sign-up. The keys are made from 24 words in your browser and stay there.

## Demo

<p align="center">
  <a href="https://mitoshi.xyz/demo">
    <img src=".github/assets/demo-cover.png" width="960" alt="Play the Mitoshi demo: Trade privately from anywhere, over three phone screens from the app." />
  </a>
</p>

The two-minute recording is being made. Until it is up, [/demo](https://mitoshi.xyz/demo) shows a still from the app
and links straight to the live screens.

## A first trade

1. **Make a private balance.** Open [mitoshi.xyz/wallet](https://mitoshi.xyz/wallet), write down 24 words and check
   three of them. The wallet engine runs in a Web Worker in your browser.
2. **Deposit ZEC.** Send from Zodl or any shielded wallet to the address Mitoshi shows (a fresh one each time). A fully
   shielded deposit can be used at once; value that came from a public address rests for 2–6 hours first.
3. **Open a market.** Say NVIDIA on Polymarket Perps. The ticket starts with the amount: type $25, pick 5× leverage and
   a take-profit in their sheets.
4. **Fund a private wallet.** Mitoshi derives a new key for this position and pays one standard amount (0.01, 0.02,
   0.05, 0.1… ZEC) from the shielded pool to a NEAR Intents deposit address. 1Click delivers the venue's collateral to the
   new wallet. Its own estimate for these routes was 452–465 seconds in dry quotes on 2026-10-22.
5. **Trade.** The order goes to the venue's real book, signed by the new wallet's key.
6. **Look at it as a stranger would.** "What the public sees" shows the wallet's public record: one funding from a NEAR
   swap, one position, no history, no links.
7. **Close and come home.** Closing sells at market and swaps the proceeds back to ZEC at a fresh shielded address.
   Leftovers smaller than the trip home are shown as dust, never merged into another wallet.

## Venues

| Venue | What you trade | How a fresh wallet is set up | Collateral |
| --- | --- | --- | --- |
| **Polymarket** | Prediction markets | A Deposit Wallet per position, created gasless through Polymarket's relayer | USDC on Polygon, bridged to pUSD |
| **Polymarket Perps** | US stocks, indices, gold, oil | A fresh key opens a perps account and signs orders through a 7-day proxy key; the first deposit (10 pUSD minimum) registers it | pUSD from that wallet's Deposit Wallet |
| **Hyperliquid** | Crypto perps | A fresh key; USDC arrives on HyperCore and moves spot to perp (a new account pays Hyperliquid's 1 USDC activation fee) | USDC |
| **Solana** | Tokens, through Jupiter | A fresh ed25519 key | SOL, which also pays gas |

Orders carry **no builder tag**: Polymarket publishes the builder field when it is set. Prices, books and candles come
from each venue's public feeds through Mitoshi's relay, so your IP never reaches the venue.

## Who sees what

| Party | Sees | Does not see |
| --- | --- | --- |
| **Cloudflare relay** (`mitoshi-web`) | Your IP address, the size of each request, and which public markets you look at (prices and books are public data) | What you asked about your wallets: every user call, and every picture of something you hold, is an encrypted [Oblivious HTTP](https://www.rfc-editor.org/rfc/rfc9458) message |
| **Gateway** (Vercel, Dublin) | The decrypted request, from a Cloudflare address | Your IP, or which requests come from the same person |
| **Each venue** | That wallet's own orders and positions, from Ireland | Your other wallets, your balance, your IP |
| **NEAR Intents** | One swap: a shielded deposit to a new wallet, with a fresh refund address | Who sent it, or any other swap of yours |
| **Zcash chain** | That a shielded transaction happened | Amounts, addresses, or that it was you |
| **Mitoshi's servers** | Only what the relay and gateway rows say; there is no database and no account | Your keys, your list of wallets, your positions: they live only in your browser, encrypted |

Visible on purpose, and shown in the app: each wallet's own trades; one public hop per funding or return, at a standard
amount; NEAR's record of the swap; and Polymarket's builder attribution on each wallet's gasless relayer calls (creation,
approvals, redeeming, moving pUSD into Perps, the trip home), which tells Polymarket these come from Mitoshi users, not
which one. The full threat model
is at [/docs/privacy](https://mitoshi.xyz/docs/privacy).

## Architecture

```
Browser (static Next.js export on mitoshi.xyz)
 ├─ App: React 19, TanStack Query, Tailwind v4, a canvas chart engine
 ├─ Wallet worker: zcash_client_sqlite on wasm32-wasip1 (sync, balance, fresh addresses, proofs, sends)
 ├─ Engine: denominations, rest rules, random scheduler, wallet registry, leak meter
 └─ Venue adapters: Polymarket · Polymarket Perps · Hyperliquid · Solana (Jupiter) · 1Click rails

every user call:  browser ──OHTTP──▶ mitoshi-web /relay/ohttp   (Cloudflare Worker, placed in eu-west-1)
                                   ──▶ mitoshi-gateway          (Vercel Function, dub1)  ──▶ allowlisted upstreams
public data:      browser ──▶ mitoshi-web /relay/live/* and /relay/img   (one shared feed per market; pictures proxied)
```

- **Two hops.** The relay learns who, the gateway learns what. The relay's Worker logs are off; the gateway writes no
  logs of its own, and Vercel's request log sees only the relay's Cloudflare address and the gateway's path.
- **The gateway runs on Vercel, not Cloudflare.** Tests on 2026-10-22 showed that a Cloudflare Worker passes the
  visitor's country to Cloudflare-hosted sites, Polymarket among them. From Vercel's Dublin region every request
  leaves from Ireland, the region Polymarket's docs name as the closest one without restrictions.
- **The gateway calls only an allowlist** of hosts and paths ([services/gateway/src/constants.ts](services/gateway/src/constants.ts)).
  It holds the Polymarket Builder secret and signs only Deposit Wallet relayer requests.
- **Pages arrive as built.** Every page has a CSP with per-page script hashes, cross-origin isolation, and
  `Cache-Control: no-transform`, so Cloudflare cannot inject analytics or rewrite a page. The 404 page carries its own
  policy in a meta tag.

## Built on Zcash

- **A real Zcash wallet in the browser.** Zcash's own `zcash_client_sqlite` 0.23 and `zcash_client_backend` 0.25
  (with `zcash_protocol` 0.11, which carries the mainnet NU7 height 3,543,405), compiled to `wasm32-wasip1` and run in a
  Web Worker through a WASI shim. It scans and spends Ironwood (NU6.3) and Orchard notes; Sapling is never spent.
  The wallet database is encrypted (AES-GCM) into IndexedDB.
- **ZIP 32** keys from the 24 words. Venue keys use a hardened path of our own (BIP32 for EVM, SLIP-0010 for Solana).
- **ZIP 318** (draft, "Orchard to Ironwood Migration") supplies the canonical denominations (n × 10^k ZEC, n ∈ {1, 2, 5})
  and the timing rules: random delays, and never syncing and broadcasting in the same window.
- **ZIP 315** wallet practice for rest periods, and **ZIP 317** fees.
- **Light client over OHTTP.** Even a block range reveals a wallet's birthday, so every lightwalletd call is an OHTTP
  message. Compact blocks currently come from ChainSafe's public gRPC-web servers, which only ever see the gateway.
- **NEAR Intents 1Click** for every rail in and out of the pool, with a fresh shielded refund address per swap.

## What is verified

Dated, and checked again on 2026-10-23.

| What | Evidence |
| --- | --- |
| Browser wallet builds, proves and broadcasts an Ironwood spend (NU7 testnet) | `ceb45a85df00f55d8a7b6c4318c65aa22c33c702a4bff476c2feef0dee7d4e5d`, mined at height 4,529,708 (9,166 bytes). Proving key warm-up 11.8 s, proof about 17.5 s single-threaded |
| Sends from the app, direct and over OHTTP | `c1569f9f34a75c6896b272f7804ed501285acbfb472ce1dcf53fc869fa6938e2` (height 4,529,789) and `8a14a08bc1af88c6b8f644fdc22d11731e431a8b2257fccac4a3768430981b86` (height 4,529,846) |
| No third-party request from the page | On mitoshi.xyz the resource list holds one host, mitoshi.xyz; every user call is `POST /relay/ohttp` |
| Live public data on every venue | Polymarket events and odds, Polymarket Perps and Hyperliquid prices and candles, Jupiter tokens, all through the relay |
| Gateway egress | Ireland (Vercel dub1, AWS eu-west-1) for every visitor |
| Polymarket over OHTTP | SDK market lookup, pUSD reads, a bridge quote (60 USDC → 59.987 pUSD), and, with the Builder keys set (2026-10-23), the gateway's builder signer returning signed relayer headers |
| Confidential swaps on NEAR | With the partner key on the gateway (2026-10-23), a dry 1Click quote over OHTTP is accepted in confidential mode (0.01 ZEC → 11.86 USDC on HyperCore, about 465 s) |
| Unit tests | 28 passing: engine 14 (denominations, rest rules, scheduler, registry, leak meter), rails 7 (1Click quotes and signature check), venues 7 (Polymarket Perps signing) |

The three testnet transactions were read back with `GetTransaction` from `zcash-testnet.chainsafe.dev`, the light
server the wallet syncs from. Public testnet explorers such as testnet.zcashexplorer.app follow an older testnet chain
(its tip was block 4,489,821 on 2026-10-23), so they do not show them.

**Not yet run on mainnet:** the full round trip on each venue (fund a fresh wallet, trade, close, come home). It waits
for mainnet ZEC in the test wallet and Polymarket Builder keys on the gateway. Until it has run, no live trade is
claimed here.

## Limits

- **The venues see trades.** Each wallet's orders are public on its venue; Mitoshi hides who placed them, not what was traded.
- **Funding takes minutes.** A fresh wallet is ready after one swap (1Click estimates about 7.5 minutes). One ready
  wallet per venue can be kept warm while the app is open.
- **Timing.** Funding runs at sampled random moments and portfolio reads are jittered, but a watcher with the full
  public record can still try timing analysis. The rest rules and standard amounts are what make that hard.
- **Two hops you have to trust not to collude.** One operator runs the relay and the gateway and also serves the app,
  so keeping them apart is a promise you can check in this repository, not something the code can enforce.
- **Light servers.** Compact blocks come from public servers until Mitoshi runs its own.
- **Web only.** There is no app-store build.

## Run it locally

Needs Node 24+ and pnpm 12. The wallet's WASM build is committed, so Rust is not needed.

```bash
pnpm install
```

```bash
pnpm --filter @mitoshi/web dev
```

That serves http://localhost:3300 on Zcash testnet, using the deployed relay at mitoshi.xyz/relay. For mainnet on
port 3301:

```bash
pnpm --filter @mitoshi/web dev:main
```

Checks:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Rebuild the wallet WASM (Rust, LLVM clang and the wasi-libc sysroot): `pnpm --filter @mitoshi/zwallet build:wasm`.
Deploys: `pnpm --filter @mitoshi/web-worker deploy` (web app and relay, Cloudflare) and
`pnpm --filter @mitoshi/gateway deploy` (gateway, Vercel). The owner sets secrets on the gateway; none live in the repo.

## Find the code and guides

| Area | Where |
| --- | --- |
| Web app: screens, flows, states | [apps/web/src/features](apps/web/src/features) |
| Wallet engine (Rust → WASM) and its worker client | [packages/zwallet](packages/zwallet) |
| Denominations, rest rules, scheduler, registry, leak meter | [packages/engine](packages/engine) |
| 1Click quotes, deposits, status, signature check | [packages/rails](packages/rails) |
| Venue adapters | [packages/venues](packages/venues) (`polymarket`, `pmperps`, `hyperliquid`, `solana`) |
| OHTTP client and the pinned key config | [packages/net](packages/net) |
| Chart engine | [packages/chart](packages/chart) |
| Relay, live feeds, image proxy, web hosting | [services/web](services/web) |
| OHTTP gateway, upstream allowlist, builder signer | [services/gateway](services/gateway) |
| Guides | [How it works](https://mitoshi.xyz/docs/how-it-works) · [Privacy](https://mitoshi.xyz/docs/privacy) · [Venues](https://mitoshi.xyz/docs/venues) · [Fees](https://mitoshi.xyz/docs/fees) · [Architecture](https://mitoshi.xyz/docs/architecture) · [Recovery](https://mitoshi.xyz/docs/recovery) |

## Provenance and credits

- **Original work.** Written for ZECATHON from 2026-10-22. No code is copied from the earlier Mitoshi or from the
  author's other products.
- **README art.** The banner and demo cover are composed in HTML ([.github/assets/source](.github/assets/source)) from
  unchanged captures of the live app on 2026-10-23, and rendered with headless Chrome. The cover is artwork with a play
  button, not a recording, and shows no transaction. Details are in [provenance.json](.github/assets/provenance.json).
- **Marks.** Coin and network marks come from [`@web3icons/core`](https://github.com/0xa3k5/web3icons) (MIT); the
  Polymarket and Jupiter marks are vendored as described in [SOURCES.md](apps/web/scripts/venues/SOURCES.md). Every mark
  belongs to its owner and is used only to name the venue.
- **Fonts.** Sora, Inter and JetBrains Mono (SIL OFL), self-hosted at build time; a Noto Serif JP subset for 見通し
  (SIL OFL 1.1, [licence](apps/web/src/fonts/noto-serif-jp/OFL.txt)).

## License

MIT

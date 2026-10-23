<p align="center">
  <a href="https://mitoshi.xyz">
    <img src=".github/assets/banner.png" width="960" alt="Mitoshi 見通し. Trade Polymarket and Hyperliquid from shielded ZEC. Each position opens from a brand-new wallet funded through NEAR Intents: copy traders find one trade and no history. Three phone screens from the app: a Polymarket event, the NVIDIA perps terminal and a Long order sheet." />
  </a>
</p>

<h1 align="center">Mitoshi · 見通し</h1>
<p align="center"><b>A new wallet for every trade.</b><br/>Trade Polymarket and Hyperliquid from shielded ZEC.</p>

<p align="center">
  <a href="https://mitoshi.xyz"><b>Open Mitoshi</b></a>
  &nbsp;·&nbsp;
  <a href="https://mitoshi.xyz/demo"><b>Demo</b></a>
  &nbsp;·&nbsp;
  <a href="https://docs.mitoshi.xyz"><b>Docs</b></a>
  &nbsp;·&nbsp;
  <a href="#who-sees-what"><b>Who sees what</b></a>
  &nbsp;·&nbsp;
  <a href="#proof-and-evidence"><b>Proof</b></a>
  &nbsp;·&nbsp;
  <a href="https://mitoshi.xyz/status"><b>Status</b></a>
</p>

Each position opens from a brand-new wallet funded through NEAR Intents, so copy traders find one trade and no
history. Your balance never leaves Zcash's shielded pool: a real Zcash wallet runs in your browser, every funding is one
standard amount sent at a random moment, every call about your wallets goes out encrypted through two hops, and when
you close, the money comes home to a fresh shielded address. The market sees the trade, not who made it.

Built for **[ZECATHON](https://thezecathon.com) · Private Markets** ([how Mitoshi meets the hackathon](#how-mitoshi-meets-the-hackathon)).
*Mitoshi* (見通し) means **outlook**: the view ahead.

## One trade, start to finish

<p align="center">
  <img src="apps/web/public/captures/event.jpg" width="250" alt="A Polymarket event in Mitoshi: Republican Presidential Nominee 2028, J.D. Vance at 44.1%, with a one-month odds chart and Yes 44¢ / No 56¢." />
  <img src="apps/web/public/captures/terminal.jpg" width="250" alt="The Polymarket Perps terminal in Mitoshi: NVIDIA at 214.42 on one-hour candles, with Long and Short." />
  <img src="apps/web/public/captures/order.jpg" width="250" alt="The Long NVIDIA order sheet: $25 at 5× leverage, $125.00 position, 0.58164 NVDA, fee $0.05." />
</p>

1. **A private balance.** Create a wallet at [mitoshi.xyz/wallet](https://mitoshi.xyz/wallet): 24 words, made and kept in
   your browser. Deposit shielded ZEC from Zodl to a fresh address. No account, no sign-up.
2. **Pick a market.** Say NVIDIA on Polymarket Perps. The ticket starts with the amount: **$25 at 5×** is a **$125.00**
   position, **0.58164 NVDA**, fee **$0.05**.
3. **A wallet nobody has seen.** Mitoshi derives a new key for this position and pays one standard amount (0.01, 0.02,
   0.05 … ZEC) from the shielded pool into NEAR Intents at a random moment. A confidential quote on 2026-10-23 turned
   **0.01 ZEC into 11.86 USDC in about 465 s**.
4. **Trade.** The order goes to the venue's real book, signed by that wallet's own key.
5. **See what a copy trader sees.** "What the public sees" opens the wallet's public record: one funding from a NEAR
   swap, one trade, no history, no link to your other wallets.
6. **Come home.** Closing sells at market and swaps the proceeds back to a fresh shielded address.

### Who sees what

| Party | Sees | Never sees |
| --- | --- | --- |
| **The venue** (Polymarket, Hyperliquid, Jupiter) | One fresh wallet's own trades, sent from Ireland | Your other wallets, your balance, your IP or country |
| **A copy trader** | A wallet with one funding from a NEAR swap and one trade | Whose it is, or any other wallet of yours |
| **NEAR Intents** | One swap per funding or trip home, confidential except Polymarket's trip home, with a fresh shielded refund address | Who sent it, or any other swap of yours |
| **The Zcash chain** | That a shielded transaction happened | Amounts, addresses, or that it was you |
| **Relay** (Cloudflare) | Your IP and which public markets you look at | What you ask about your wallets: every user call is an encrypted [Oblivious HTTP](https://www.rfc-editor.org/rfc/rfc9458) message |
| **Gateway** (Vercel, Dublin) | One decrypted request, from the relay's address | Your IP, or which requests come from the same person |

No server holds your keys, your list of wallets or your positions; they live only in your browser, encrypted. What is
public on purpose (each wallet's own trades, one hop per funding at a standard amount, NEAR's swap record, and Polymarket's
builder attribution on gasless wallet calls) is in the [threat model](https://docs.mitoshi.xyz/privacy).

## Demo video

<p align="center">
  <a href="https://mitoshi.xyz/demo">
    <img src=".github/assets/demo-cover.png" width="960" alt="Play the Mitoshi demo: A new wallet for every trade, over three phone screens from the app." />
  </a>
</p>

Follow the proof on the live app:

1. Open a stock: [NVIDIA on Polymarket Perps](https://mitoshi.xyz/trade#pm/NVDA-USD), live candles and the order sheet.
2. Open an event: [Predict](https://mitoshi.xyz/predict), any market's odds history and Yes/No ticket.
3. Open DevTools → Network on any page: every request goes to mitoshi.xyz, and every user call is `POST /relay/ohttp`.
4. Read [who sees what](https://docs.mitoshi.xyz/privacy#who-sees-what) and the [service status](https://mitoshi.xyz/status) of each hop.

## How it works

<p align="center">
  <a href="https://docs.mitoshi.xyz/architecture">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/system-map-dark.png" />
      <img src=".github/assets/system-map-light.png" width="960" alt="System map: the Mitoshi app, its Zcash wallet and per-position keys in the browser send every user call over Oblivious HTTP to a Cloudflare relay that sees the IP, then to a Vercel gateway in Dublin that sees the request, then to allowlisted upstreams: the Zcash light server, NEAR Intents 1Click, and Polymarket, Hyperliquid and Jupiter. Public prices come through the relay." />
    </picture>
  </a>
</p>
<p align="center"><a href="https://docs.mitoshi.xyz/architecture#the-system-map">Open the detailed map</a> · <a href=".github/diagrams/readme-system.mmd">Edit the Mermaid source</a></p>

<p align="center">
  <a href="https://docs.mitoshi.xyz/private-wallets">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/funding-flow-dark.png" />
      <img src=".github/assets/funding-flow-light.png" width="960" alt="Funding round trip: at a random moment, your shielded ZEC sends one standard amount with a fresh shielded refund address to NEAR Intents, which pays USDC, pUSD or SOL to a fresh wallet in a confidential swap; the wallet opens one position on the venue, closes it, sends the proceeds back through NEAR Intents to a fresh shielded address. A copy trader finds one funding, one trade, no history." />
    </picture>
  </a>
</p>
<p align="center"><a href="https://docs.mitoshi.xyz/architecture#the-moneys-route">Open the step-by-step guide</a> · <a href=".github/diagrams/readme-funding.mmd">Edit the Mermaid source</a></p>

- **One wallet per position.** An order goes to the wallet that already trades that market, otherwise to a ready wallet
  that has never traded, otherwise a new one is funded; another position's wallet is never used. Keys come from your 24
  words on a hardened path of their own, so no two wallets share a key, a proxy, a refund address or a request.
- **Standard amounts at random times.** Fundings use the canonical denominations of ZIP 318 (n × 10^k ZEC, n ∈ {1, 2, 5}),
  start 20 s to 3 min after you ask, and never at a deposit or when the app opens. A keep-ready replacement waits a random
  delay (90 min on average, at most 12 h), so a new wallet never appears right after your trade. ZEC that arrived from a
  public address rests 2–6 hours first.
- **Two hops, nothing third-party.** Every page and every worker may reach mitoshi.xyz only (CSP with per-page script
  hashes), and pages are sent `no-transform`, so no proxy can add a script. Pictures of what you hold come over OHTTP too.
- **A leak meter on every send** flags a withdrawal that matches a recent payout in amount or timing.

| Built on | What it does | Where |
| --- | --- | --- |
| **Zcash** · librustzcash | `zcash_client_sqlite` 0.23 and `zcash_client_backend` 0.25 (`zcash_protocol` 0.11, NU7-ready), compiled to `wasm32-wasip1`: sync, Ironwood and Orchard notes, proofs and sends in a Web Worker, encrypted into IndexedDB | [packages/zwallet](packages/zwallet) |
| **Zcash** · ZIPs 32, 315, 317, 318 | Keys from the 24 words; rest periods; fees; canonical amounts and timing | [packages/engine](packages/engine) |
| **NEAR Intents** · 1Click | Every rail in and out of the shielded pool, in confidential mode, with signed quotes checked before any deposit | [packages/rails](packages/rails) |
| **Oblivious HTTP** (RFC 9458) | The client, the relay and the gateway with its upstream allowlist | [packages/net](packages/net) · [services/web](services/web) · [services/gateway](services/gateway) |
| **Venues** | Polymarket (Deposit Wallets, CLOB), Polymarket Perps, Hyperliquid, Solana through Jupiter | [packages/venues](packages/venues) |

## How Mitoshi meets the hackathon

ZECATHON's brief: *"Thirty days to build something on Zcash that does not leak."*

| Requirement or criterion (verbatim) | How Mitoshi meets it | Check it |
| --- | --- | --- |
| **Privacy:** "Does it actually preserve privacy, or does it only look like it does? Leaks are disqualifying, not deductions." | Shielded balance in the browser, one fresh wallet per position, standard amounts at random times, confidential NEAR swaps, every call over Oblivious HTTP, no server-side state. Residuals are written down, not hidden | [Who sees what](#who-sees-what) · [threat model](https://docs.mitoshi.xyz/privacy) · [gateway allowlist](services/gateway/src/constants.ts) |
| **Usefulness:** "Would someone use this on Monday." | Traders on public venues get copied and front-run through their wallet; Mitoshi trades the venues they already use (predictions, US stocks, gold, crypto perps, tokens) with no account and no sign-up | [mitoshi.xyz](https://mitoshi.xyz) |
| **Execution:** "Does it run. Working beats ambitious." | Live on mainnet with live venue data; the browser wallet's proofs and sends confirmed on testnet; 36 unit tests | [Proof and evidence](#proof-and-evidence) |
| **Originality:** "Built for this hackathon, not repackaged." | Written during the build window; a full Zcash wallet on librustzcash compiled to WASI for the browser, and one shielded balance behind four public venues | [Commit history](https://github.com/mitoshi-xyz/mitoshi/commits/main) |
| **Private Markets:** "anything where the price should be public and the participants should not." | The venues' prices and books stay public; the trader behind each position does not | [One trade, start to finish](#one-trade-start-to-finish) |
| "All code written during the build window. Libraries are fine; existing products are not." | The repository's history starts on 2026-10-22; libraries are listed above and in the lockfile | [Prior work](#prior-work) |
| "Open source at submission." | MIT, public | [LICENSE](LICENSE) |

## Proof and evidence

Dated; re-checked on 2026-10-23.

| What | Evidence |
| --- | --- |
| The browser wallet builds, proves and broadcasts an Ironwood spend | NU7 testnet `ceb45a85df00f55d8a7b6c4318c65aa22c33c702a4bff476c2feef0dee7d4e5d`, height 4,529,708, 9,166 bytes; proving-key warm-up 11.8 s, proof about 17.5 s single-threaded |
| Sends from the app, direct and over OHTTP | `c1569f9f34a75c6896b272f7804ed501285acbfb472ce1dcf53fc869fa6938e2` (height 4,529,789) and `8a14a08bc1af88c6b8f644fdc22d11731e431a8b2257fccac4a3768430981b86` (height 4,529,846) |
| No third-party request from a page | On mitoshi.xyz the resource list holds one host, mitoshi.xyz |
| Confidential swaps on NEAR | A dry 1Click quote over OHTTP accepted in confidential mode: 0.01 ZEC → 11.86 USDC on HyperCore, about 465 s |
| Polymarket over OHTTP | Market lookup, pUSD reads, a bridge quote (60 USDC → 59.987 pUSD), and the gateway's builder signer returning signed relayer headers |
| Gateway egress | Ireland (Vercel dub1) for every visitor, so no venue learns a user's country |
| Unit tests | 36 passing: engine 22 (denominations, rest rules, scheduling, one wallet per position, registry, keys, leak meter), rails 7 (1Click quotes and signature check), venues 7 (Polymarket Perps signing) |

The testnet transactions were read back with `GetTransaction` from the light server the wallet syncs from; public
testnet explorers follow an older testnet chain and do not show them.

**Also in the app:** a [portfolio](https://mitoshi.xyz/portfolio) across every wallet and venue, private
[wallets](https://mitoshi.xyz/wallets) with their timeline and "keep one ready", the copy-trader's view of each wallet,
backup and recovery from the 24 words, and a [status](https://mitoshi.xyz/status) page for every hop. Guides:
[how it works](https://docs.mitoshi.xyz/private-wallets) · [venues](https://docs.mitoshi.xyz/venues/polymarket) ·
[fees and timing](https://docs.mitoshi.xyz/fees-and-timing) · [recovery](https://docs.mitoshi.xyz/backup-and-recovery).

## Run it locally

Needs Node 24+ and pnpm 12. The wallet's WASM build is committed, so Rust is not needed.

```bash
pnpm install
```

```bash
pnpm --filter @mitoshi/web dev
```

That serves `localhost:3300` on Zcash testnet through the deployed relay; `dev:main` serves mainnet on port 3301.
Checks: `pnpm lint && pnpm typecheck && pnpm test`. Rebuild the wallet WASM with
`pnpm --filter @mitoshi/zwallet build:wasm` (Rust, LLVM clang and the wasi-libc sysroot). Deploy with
`pnpm --filter @mitoshi/web-worker deploy` (app and relay) and `pnpm --filter @mitoshi/gateway deploy` (gateway); its
secrets are set on the host, never in the repository.

| Area | Where |
| --- | --- |
| Screens, flows and states | [apps/web/src/features](apps/web/src/features) |
| Zcash wallet (Rust → WASM) and its worker | [packages/zwallet](packages/zwallet) |
| Amounts, timing, registry, leak meter | [packages/engine](packages/engine) |
| NEAR Intents 1Click | [packages/rails](packages/rails) |
| Venue adapters | [packages/venues](packages/venues) |
| OHTTP client and pinned key | [packages/net](packages/net) |
| Chart engine | [packages/chart](packages/chart) |
| Relay, live feeds, hosting | [services/web](services/web) |
| Gateway and upstream allowlist | [services/gateway](services/gateway) |
| README diagrams | [.github/diagrams](.github/diagrams) |

## Credits

- **Marks.** Coin and network marks from [`@web3icons/core`](https://github.com/0xa3k5/web3icons) (MIT); the Polymarket
  and Jupiter marks are vendored as described in [SOURCES.md](apps/web/scripts/venues/SOURCES.md). Every mark belongs to
  its owner and is used only to name the venue.
- **Fonts.** Sora, Inter and JetBrains Mono (SIL OFL), self-hosted; a Noto Serif JP subset for 見通し (SIL OFL 1.1,
  [licence](apps/web/src/fonts/noto-serif-jp/OFL.txt)).
- **Images.** The banner and demo cover are composed in HTML ([.github/assets/source](.github/assets/source)) from
  unchanged captures of the live app, and the cover is artwork with a play button, not a recording; see
  [provenance.json](.github/assets/provenance.json).

## Prior work

Mitoshi was written for ZECATHON; this repository's history starts on 2026-10-22. It shares only its name and brand
with an earlier, unrelated project, and uses none of its code.

## Honest limits

- **The full mainnet round trip has not run yet** (fund a fresh wallet, trade, close, come home). The parts are live and
  verified one by one above; the end-to-end run waits for test funds.
- **The venue sees the trade.** Each wallet's orders are public on its venue; Mitoshi hides who placed them, not what was
  traded.
- **Polymarket's trip home is not a confidential swap.** Its bridge pays out an inexact amount, which NEAR's
  confidential mode cannot take, so NEAR's public record pairs that payout with the fresh shielded address it goes to.
- **Funding takes minutes:** about 7.5 by 1Click's estimate, unless a wallet is kept ready.
- **Timing analysis.** Random start times, standard amounts and rest periods make it hard, not impossible, for someone
  holding the whole public record.
- **One operator runs both hops and serves the app**, so keeping relay and gateway apart is a promise you can check in
  this repository, not something the code enforces.
- **Public light servers** serve the compact blocks; they only ever see the gateway.
- **Web only.**

## License

MIT

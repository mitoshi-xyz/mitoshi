import { Box, Figure, Key, Note, Pill, TALL_W, TALL_X, Wire, Zone } from "./kit-art";

/**
 * The system map. Sources: apps/web (the static app), packages/zwallet (the wallet worker), packages/engine,
 * packages/venues and packages/rails (adapters), services/web/src/index.ts (relay routes /relay/ohttp, /relay/img and
 * /relay/live/*), services/web/src/live.ts (one feed object per venue, market channels only),
 * services/gateway/src/constants.ts (the allowlist) and services/gateway/src/img.ts (the image fetch).
 */

const KEY = [
  { tone: "accent", text: "Sealed with Oblivious HTTP: every call about you" },
  { tone: "quiet", text: "Public market data and pictures: the relay sees which" },
] as const;

const BROWSER = [
  { title: "App", lines: ["Screens and tickets", "Static: no app server"] },
  { title: "Wallet worker", lines: ["Zcash's wallet in WASM", "Sync, proofs, sends"] },
  { title: "Engine", lines: ["Sizes, rests, timing,", "and the leak meter"] },
  { title: "Venue adapters", lines: ["Four venues and", "NEAR 1Click quotes"] },
  { title: "Vault", lines: ["Keys and wallet list,", "encrypted on device"] },
];

/** Columns of the wide drawing: browser, relay, gateway, upstreams. */
const RELAY_X = 244;
const GATEWAY_X = 450;
const UP_X = 656;
const COL = 176;

function Wide(p: string) {
  return (
    <>
      <Zone x={10} y={10} w={204} h={500} label="YOUR BROWSER" />
      {BROWSER.map((b, i) => (
        <Box key={b.title} x={20} y={40 + i * 92} w={184} title={b.title} lines={b.lines} />
      ))}

      <Wire d={`M214 136 H${RELAY_X - 4}`} p={p} tone="accent" />
      <Box
        x={RELAY_X}
        y={80}
        w={COL}
        kicker="CLOUDFLARE"
        title="Relay"
        lines={["/relay/ohttp", "Sees IP, not content", "No IP or cookies sent"]}
        mono={[0]}
        tone="accent"
      />
      <Wire d={`M${RELAY_X + COL} 136 H${GATEWAY_X - 4}`} p={p} tone="accent" />
      <Box
        x={GATEWAY_X}
        y={80}
        w={COL}
        kicker="VERCEL · DUBLIN"
        title="Gateway"
        lines={["Opens each request", "Sees content, not IP", "No logs of its own"]}
        tone="accent"
      />
      <Note
        x={GATEWAY_X + 14}
        y={218}
        lines={["Holds Polymarket's", "Builder secret; signs", "only Deposit Wallet", "relayer calls"]}
      />
      <Wire d={`M${GATEWAY_X + COL} 136 H${UP_X - 4}`} p={p} tone="accent" />
      <Box
        x={UP_X}
        y={32}
        w={COL}
        kicker="ALLOWLIST ONLY"
        title="Upstreams"
        lines={[
          "Zcash light servers",
          "NEAR Intents 1Click",
          "Polymarket APIs",
          "Polymarket Perps API",
          "Hyperliquid API",
          "Jupiter, Solana RPC",
          "Polygon RPC",
          "GeckoTerminal",
        ]}
      />

      <Wire d={`M214 362 H${RELAY_X - 4}`} p={p} tone="quiet" />
      <Box
        x={RELAY_X}
        y={306}
        w={COL}
        kicker="DURABLE OBJECT"
        title="Live feed"
        lines={["/relay/live/*", "One socket per venue,", "market channels only"]}
        mono={[0]}
        tone="quiet"
      />
      <Wire d={`M${RELAY_X + COL} 362 H${UP_X - 4}`} p={p} tone="quiet" />
      <Pill x={(RELAY_X + COL + UP_X) / 2} y={362} text="no user channels" />
      <Box
        x={UP_X}
        y={306}
        w={COL}
        kicker="PUBLIC"
        title="Venue feeds"
        lines={["Hyperliquid", "Polymarket", "Polymarket Perps"]}
        tone="quiet"
      />

      <Wire d={`M214 478 H${RELAY_X - 4}`} p={p} tone="quiet" />
      <Box
        x={RELAY_X}
        y={438}
        w={COL}
        title="Image proxy"
        lines={["/relay/img", "Public, cached 24 h"]}
        mono={[0]}
        tone="quiet"
      />
      <Wire d={`M${RELAY_X + COL} 478 H${GATEWAY_X - 4}`} p={p} tone="quiet" />
      <Box
        x={GATEWAY_X}
        y={438}
        w={COL}
        title="Image fetch"
        lines={["Checked on every hop", "Held assets: sealed"]}
        tone="quiet"
      />
      <Wire d={`M${GATEWAY_X + COL} 478 H${UP_X - 4}`} p={p} tone="quiet" />
      <Box x={UP_X} y={448} w={COL} title="Image hosts" lines={["Logos and pictures"]} tone="quiet" />

      <Key x={20} y={548} p={p} items={[...KEY]} />
    </>
  );
}

const BROWSER_TALL = [
  { title: "App", line: "Screens, charts, order tickets" },
  { title: "Wallet worker", line: "Zcash's wallet in WASM: sync, proofs" },
  { title: "Engine", line: "Sizes, rest rules, timing, leak meter" },
  { title: "Venue adapters", line: "Polymarket, Perps, Hyperliquid, Solana" },
  { title: "Vault", line: "Keys and wallet list, encrypted" },
];

function Tall(p: string) {
  return (
    <>
      <Zone x={16} y={16} w={328} h={380} label="YOUR BROWSER · MITOSHI.XYZ" />
      {BROWSER_TALL.map((b, i) => (
        <Box key={b.title} x={28} y={44 + i * 69} w={304} title={b.title} lines={[b.line]} />
      ))}
      <Wire d="M180 396 V446" p={p} tone="accent" />
      <Pill x={180} y={421} text="OHTTP · sealed" tone="accent" />
      <Box
        x={16}
        y={450}
        w={328}
        kicker="CLOUDFLARE WORKER"
        title="Relay"
        lines={["Sees your IP, not the content", "No IP, cookies or agent passed on"]}
        tone="accent"
      />
      <Wire d="M180 543 V592" p={p} tone="accent" />
      <Pill x={180} y={567} text="same sealed bytes" tone="accent" />
      <Box
        x={16}
        y={596}
        w={328}
        kicker="VERCEL FUNCTION · DUBLIN"
        title="Gateway"
        lines={["Sees the content, not your IP", "Writes no logs of its own", "Signs only Deposit Wallet calls"]}
        tone="accent"
      />
      <Wire d="M180 708 V756" p={p} tone="accent" />
      <Pill x={180} y={732} text="HTTPS, from Ireland" />
      <Box
        x={16}
        y={760}
        w={328}
        kicker="ALLOWLIST ONLY"
        title="Upstreams"
        lines={[
          "Zcash light servers, NEAR 1Click",
          "Polymarket, Polymarket Perps",
          "Hyperliquid, Jupiter, Solana RPC",
          "Polygon RPC, GeckoTerminal",
        ]}
      />
      <Box
        x={16}
        y={916}
        w={328}
        kicker="PUBLIC DATA · NOT SEALED"
        title="Live feed and pictures"
        lines={[
          "/relay/live/*: one WebSocket per venue,",
          "market channels only",
          "/relay/img: public pictures, 24 h cache",
          "Pictures of what you hold go sealed",
        ]}
        tone="quiet"
      />
      <Key
        x={28}
        y={1072}
        p={p}
        items={[
          { tone: "accent", text: "Sealed (Oblivious HTTP)" },
          { tone: "quiet", text: "Public data, not sealed" },
        ]}
      />
    </>
  );
}

export function SystemMap() {
  return (
    <Figure
      id="system-map"
      label="System map: the browser runs the app, the Zcash wallet, the engine and the venue adapters. Every call about you is sealed with Oblivious HTTP and goes browser to relay (Cloudflare) to gateway (Vercel, Dublin) to an allowlist of upstreams. Public market data and pictures take a separate, unsealed path through the relay."
      caption="Every call about you takes the vermilion path. The relay knows who is asking, the gateway knows what is asked, and neither knows both."
      wide={{ w: 840, h: 590, body: Wide }}
      tall={{ x: TALL_X, w: TALL_W, h: 1110, body: Tall }}
    />
  );
}

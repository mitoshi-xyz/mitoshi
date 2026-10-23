import { Box, Figure, Note, Pill, TALL_W, TALL_X, Wire } from "./kit-art";

/**
 * A private wallet's life. Sources: packages/engine/src/registry.ts (statuses and NEXT, the moves allowed),
 * packages/engine/src/schedule.ts and constants.ts (fundingTime, refillTime: exponential, mean 90 min, at most 12 h),
 * apps/web/src/features/private-wallets (jobs.ts, home.ts: ready, trading or failed wallets can be sent home), the
 * venues' DUST_* constants (under 1 USDC or pUSD, under 0.005 SOL).
 */

/** The wide drawing is a snake: steps 1–3 left to right, 4–6 right to left, then the two side exits. */
const STATES = [
  { title: "Preparing", lines: ["New key, no money yet;", "starts 20 s–3 min later"], col: 0, row: 0 },
  { title: "Funding", lines: ["One 1Click swap, ~7.5 min;", "Polymarket adds ~30 s"], col: 1, row: 0 },
  { title: "Ready", lines: ["Funded and unused; keep", "one ready per venue"], col: 2, row: 0 },
  { title: "Trading", lines: ["Orders signed by its own", "key, on the venue's book"], col: 2, row: 1 },
  { title: "Coming home", lines: ["Close and swap to ZEC,", "~2.5 min, then a 2–6 h rest"], col: 1, row: 1 },
  { title: "Retired", lines: ["Empty for good; under ~$1", "stays behind as dust"], col: 0, row: 1 },
];

const W = 236;
const COLS = [10, 302, 594];
const ROWS = [40, 236];
const H = 93;

function Wide(p: string) {
  const [x0 = 0, x1 = 0, x2 = 0] = COLS;
  const [r0 = 0, r1 = 0] = ROWS;
  return (
    <>
      {STATES.map((s, i) => (
        <Box
          key={s.title}
          x={COLS[s.col] ?? 0}
          y={ROWS[s.row] ?? 0}
          w={W}
          kicker={`STEP ${i + 1}`}
          title={s.title}
          lines={s.lines}
          tone={i === 0 || i === STATES.length - 1 ? "plain" : "accent"}
        />
      ))}
      <Wire d={`M${x0 + W} ${r0 + H / 2} H${x1 - 4}`} p={p} tone="accent" />
      <Wire d={`M${x1 + W} ${r0 + H / 2} H${x2 - 4}`} p={p} tone="accent" />
      <Wire d={`M${x2 + W / 2} ${r0 + H} V${r1 - 4}`} p={p} tone="accent" />
      <Wire d={`M${x2} ${r1 + H / 2} H${x1 + W + 4}`} p={p} tone="accent" />
      <Wire d={`M${x1} ${r1 + H / 2} H${x0 + W + 4}`} p={p} tone="accent" />

      <path
        d={`M${x2 + 56} ${r0 + H} C ${x2 + 56} 190, ${x1 + 178} 180, ${x1 + 178} ${r1 - 4}`}
        className="dg-wire dg-wire-quiet"
        markerEnd={`url(#${p}-quiet)`}
      />
      <Pill x={x2 - 4} y={186} text="or home unused" />
      <Note x={x0 + 12} y={174} lines={["Keep one ready: a refill waits", "90 min on average, 12 h at most"]} />

      <Box
        x={x0}
        y={392}
        w={382}
        kicker="IF NEAR CANNOT SWAP"
        title="Refunded"
        lines={["NEAR sends the ZEC back to a fresh", "shielded address in your balance"]}
        tone="quiet"
      />
      <Box
        x={x0 + 438}
        y={392}
        w={382}
        kicker="IF A FUNDING STOPS"
        title="Failed"
        lines={["Nothing was sent; Try again waits", "for a new random start"]}
        tone="quiet"
      />
    </>
  );
}

const TALL = [
  { title: "Preparing", lines: ["A new key. Funding starts at a random", "moment, 20 s–3 min after you ask"] },
  { title: "Funding", lines: ["One 1Click swap, about 7.5 min", "(Polymarket: +30 s for the bridge)"] },
  { title: "Ready", lines: ["Funded and unused. Keep one ready", "per venue while the app is open"] },
  { title: "Trading", lines: ["Every order signed by this wallet's", "own key, on the venue's own book"] },
  { title: "Coming home", lines: ["Close, then swap to ZEC in about", "2.5 min; the ZEC rests 2–6 h"] },
  { title: "Retired", lines: ["Empty for good. Under ~$1 left", "behind stays as dust"] },
];

const T_STEP = 128;
const T_H = 93;

function Tall(p: string) {
  const end = 16 + TALL.length * T_STEP;
  return (
    <>
      {TALL.map((s, i) => {
        const y = 16 + i * T_STEP;
        return (
          <g key={s.title}>
            <Box
              x={16}
              y={y}
              w={328}
              kicker={`STEP ${i + 1}`}
              title={s.title}
              lines={s.lines}
              tone={i === 0 || i === TALL.length - 1 ? "plain" : "accent"}
            />
            {i < TALL.length - 1 ? <Wire d={`M180 ${y + T_H} V${y + T_STEP - 4}`} p={p} tone="accent" /> : null}
          </g>
        );
      })}
      <Box
        x={16}
        y={end}
        w={328}
        title="Refunded or failed"
        lines={["Refunds go to a fresh shielded address;", "Try again waits for a new random start"]}
        tone="quiet"
      />
      <Note
        x={16}
        y={end + 106}
        lines={[
          "Keep one ready: a replacement starts after",
          "a random wait, 90 min on average, 12 h at most.",
          "A ready wallet can also go home unused.",
        ]}
        tone="quiet"
      />
    </>
  );
}

export function Lifecycle() {
  return (
    <Figure
      id="lifecycle"
      label="A private wallet's life: preparing (a new key, funding starts at a random moment 20 seconds to 3 minutes later), funding (one 1Click swap, about 7.5 minutes), ready, trading (one position), coming home (about 2.5 minutes back to ZEC, which rests 2 to 6 hours) and retired. A funding can be refunded to a fresh shielded address; a failed step can be tried again after a new random start."
      caption="Each wallet lives once. Timings are 1Click's own estimates and Mitoshi's scheduler; the wallet's timeline in the app shows each step as it happens."
      wide={{ w: 840, h: 500, body: Wide }}
      tall={{ x: TALL_X, w: TALL_W, h: 16 + TALL.length * T_STEP + 170, body: Tall }}
    />
  );
}

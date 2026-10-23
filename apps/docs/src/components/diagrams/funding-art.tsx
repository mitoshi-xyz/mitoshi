import { Box, Figure, Note, Pill, TALL_W, TALL_X, Wire } from "./kit-art";

/**
 * The funding round trip. Sources: packages/engine/src/constants.ts (LADDER_ZAT, FUND_DELAY_*, REST_*, the key path),
 * apps/web/src/features/private-wallets/jobs.ts (quote, exact-size shielded payment, txid to 1Click) and home.ts (the
 * trip home to a fresh shielded address), packages/rails (the signed-quote check), apps/docs fees page for timings.
 */

/** Three columns, two rows: out along the top, home along the bottom. */
const C1 = 10;
const C2 = 322;
const C3 = 634;
const BW = 196;
const ROW1 = 40;
const ROW2 = 250;
const MID1 = 86;
const MID2 = 296;

function Wide(p: string) {
  return (
    <>
      <Box
        x={C1}
        y={ROW1}
        w={BW}
        kicker="ZCASH SHIELDED POOL"
        title="Your balance"
        lines={["Orchard, Ironwood notes", "Amounts stay hidden"]}
        tone="accent"
      />
      <Wire d={`M${C1 + BW} ${MID1} H${C2 - 4}`} p={p} tone="accent" />
      <Pill x={(C1 + BW + C2) / 2} y={MID1} text="public hop" tone="accent" />
      <Note
        x={(C1 + BW + C2) / 2}
        y={MID1 + 32}
        anchor="middle"
        lines={["0.01–1 ZEC only,", "random start", "20 s–3 min later,", "no memo"]}
      />

      <Box
        x={C2}
        y={ROW1}
        w={BW}
        kicker="NEAR INTENTS"
        title="1Click deposit"
        lines={["Signed quote, checked", "Refunds: fresh address"]}
      />
      <Wire d={`M${C2 + BW} ${MID1} H${C3 - 4}`} p={p} tone="accent" />
      <Pill x={(C2 + BW + C3) / 2} y={MID1} text="~7.5 min" tone="accent" />
      <Note x={(C2 + BW + C3) / 2} y={MID1 + 32} anchor="middle" lines={["USDC or SOL", "to the new key"]} />

      <Box
        x={C3}
        y={ROW1}
        w={BW}
        kicker="NEW KEY, NEVER USED"
        title="Fresh venue wallet"
        lines={["…/6874'/venue'/index'", "Trades, then goes home"]}
        mono={[0]}
      />
      <Wire d={`M${C3 + BW / 2} 134 V${ROW2 - 4}`} p={p} tone="accent" />
      <Note x={C3 + BW / 2 - 10} y={176} anchor="end" lines={["on Polymarket,", "Perps, Hyperliquid", "or Solana"]} />

      <Box
        x={C3}
        y={ROW2}
        w={BW}
        kicker="THE VENUE'S MARKET"
        title="Trade"
        lines={["Signed by its own key", "No builder code"]}
      />
      <Wire d={`M${C3} ${MID2} H${C2 + BW + 4}`} p={p} tone="accent" />
      <Pill x={(C2 + BW + C3) / 2} y={MID2} text="~2.5 min" tone="accent" />
      <Note
        x={(C2 + BW + C3) / 2}
        y={MID2 + 32}
        anchor="middle"
        lines={["close, then one", "swap to ZEC;", "under ~$1 stays", "as dust"]}
      />

      <Box
        x={C2}
        y={ROW2}
        w={BW}
        kicker="NEAR INTENTS"
        title="1Click home"
        lines={["Quote to a fresh", "shielded address"]}
      />
      <Wire d={`M${C2} ${MID2} H${C1 + BW + 4}`} p={p} tone="accent" />
      <Pill x={(C1 + BW + C2) / 2} y={MID2} text="public hop" tone="accent" />
      <Note x={(C1 + BW + C2) / 2} y={MID2 + 32} anchor="middle" lines={["a new address", "every trip"]} />

      <Box
        x={C1}
        y={ROW2}
        w={BW}
        kicker="SHIELDED POOL"
        title="Back home"
        lines={["Fresh address; rests", "2–6 h before it's spent"]}
        tone="accent"
      />
      <Wire d={`M${C1 + BW / 2} ${ROW2} V135`} p={p} tone="accent" />
      <Note x={C1 + BW / 2 + 10} y={190} lines={["joins your", "balance"]} />

      <Note
        x={C1}
        y={428}
        lines={[
          "Every quote's signature and terms are checked before any ZEC is sent.",
          "NEAR's confidential mode covers every funding and every trip home except Polymarket's.",
        ]}
        tone="quiet"
      />
    </>
  );
}

const TALL_STEPS = [
  {
    kicker: "ZCASH SHIELDED POOL",
    title: "Your balance",
    lines: ["Orchard and Ironwood notes,", "amounts and addresses hidden"],
    pill: "0.01–1 ZEC · random start",
    accent: true,
  },
  {
    kicker: "NEAR INTENTS",
    title: "1Click deposit address",
    lines: ["The one public hop in. Signed quote,", "checked; refunds to a fresh address"],
    pill: "about 7.5 min",
  },
  {
    kicker: "NEW KEY, NEVER USED",
    title: "Fresh venue wallet",
    lines: ["m/44'/coin'/6874'/venue'/index'", "USDC, pUSD or SOL arrives here"],
    pill: "trade",
    mono: [0],
  },
  {
    kicker: "THE VENUE'S OWN MARKET",
    title: "Trade",
    lines: ["Orders signed by this wallet's key;", "under ~$1 left at close stays as dust"],
    pill: "close · about 2.5 min",
  },
  {
    kicker: "NEAR INTENTS",
    title: "1Click, the way home",
    lines: ["Signed quote to a fresh shielded", "address: the one public hop out"],
    pill: "ZEC payout",
  },
  {
    kicker: "FRESH SHIELDED ADDRESS",
    title: "Back home",
    lines: ["Rests 2–6 h before it is spent,", "then joins your balance"],
    accent: true,
  },
];

const T_X = 40;
const T_W = 304;
const T_H = 93;
const T_STEP = 148;

function Tall(p: string) {
  const last = 16 + (TALL_STEPS.length - 1) * T_STEP;
  return (
    <>
      {TALL_STEPS.map((s, i) => {
        const y = 16 + i * T_STEP;
        return (
          <g key={s.title + s.kicker}>
            <Box
              x={T_X}
              y={y}
              w={T_W}
              kicker={s.kicker}
              title={s.title}
              lines={s.lines}
              mono={s.mono ?? []}
              tone={s.accent ? "accent" : "plain"}
            />
            {s.pill ? (
              <>
                <Wire d={`M192 ${y + T_H} V${y + T_STEP - 4}`} p={p} tone="accent" />
                <Pill x={192} y={y + T_H + (T_STEP - T_H) / 2} text={s.pill} tone="accent" />
              </>
            ) : null}
          </g>
        );
      })}
      <Wire d={`M${T_X} ${last + T_H / 2} H18 V${16 + T_H / 2} H${T_X - 4}`} p={p} />
      <Note x={16} y={last + T_H + 34} lines={["Every quote is checked before ZEC is sent."]} tone="quiet" />
    </>
  );
}

export function FundingFlow() {
  return (
    <Figure
      id="funding-flow"
      label="The funding round trip. One standard amount of ZEC leaves the shielded pool at a random moment for a NEAR Intents 1Click deposit address, which delivers the venue's asset to a brand-new wallet in about 7.5 minutes. That wallet trades once on the venue's own market. Closing swaps the proceeds back to ZEC at a fresh shielded address in about 2.5 minutes, where it rests 2 to 6 hours before it can be spent."
      caption="The money's whole route. Only the two hops through NEAR are public, both at standard sizes; the wallet in between has one trade and no history."
      wide={{ w: 840, h: 462, body: Wide }}
      tall={{ x: TALL_X, w: TALL_W, h: 16 + 5 * T_STEP + T_H + 56, body: Tall }}
    />
  );
}

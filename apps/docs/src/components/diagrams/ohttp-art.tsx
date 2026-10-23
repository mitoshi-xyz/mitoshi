import { Box, Figure, Note, Pill, TALL_W, TALL_X, Wire } from "./kit-art";

/**
 * The two OHTTP hops. Sources: packages/net (RFC 9458 client, the pinned key config), services/web/src/index.ts (the
 * relay forwards only the sealed body, with no IP, cookies, user agent, referrer or language),
 * services/gateway/src/constants.ts (NEVER_FORWARD, the allowlist, one shared user agent).
 */

interface Party {
  kicker: string;
  title: string;
  line: string;
  sees: [string, string];
  never: [string, string];
  seesLabel?: string;
  neverLabel?: string;
}

const PARTIES: Party[] = [
  {
    kicker: "YOU",
    title: "Your browser",
    line: "Seals every request",
    seesLabel: "KEEPS",
    sees: ["Keys, balances and", "your wallet list"],
    neverLabel: "SENDS",
    never: ["Only sealed requests", "to the pinned key"],
  },
  {
    kicker: "HOP 1 · CLOUDFLARE",
    title: "Relay",
    line: "Knows who, not what",
    sees: ["Your IP address", "Request sizes, times"],
    never: ["What you asked", "Which wallet it's for"],
  },
  {
    kicker: "HOP 2 · VERCEL",
    title: "Gateway",
    line: "Dublin: what, not who",
    sees: ["The request itself", "The relay's address"],
    never: ["Your IP or cookies", "Who sent it"],
  },
  {
    kicker: "ALLOWLISTED HOST",
    title: "Upstream",
    line: "Venue, NEAR or Zcash",
    sees: ["One wallet's request", "The gateway's address"],
    never: ["Your IP", "Your other wallets"],
  },
];

const COL_W = 180;
const STEP = 216;
const X0 = 10;
const cx = (i: number) => X0 + i * STEP + COL_W / 2;

/** What one party sees and never sees, as a card. */
function Sees({ x, y, w, party }: { x: number; y: number; w: number; party: Party }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={150} rx={10} className="dg-box dg-box-plain" />
      <text x={x + 14} y={y + 22} className="dg-kicker">
        {party.seesLabel ?? "SEES"}
      </text>
      <Note x={x + 14} y={y + 42} lines={party.sees} />
      <text x={x + 14} y={y + 92} className="dg-kicker">
        {party.neverLabel ?? "NEVER SEES"}
      </text>
      <Note x={x + 14} y={y + 112} lines={party.never} />
    </g>
  );
}

const MESSAGES = [
  { from: 0, to: 1, y: 128, tone: "accent", text: "sealed request" },
  { from: 1, to: 2, y: 128, tone: "accent", text: "same sealed bytes" },
  { from: 2, to: 3, y: 128, tone: "plain", text: "HTTPS, from Ireland" },
  { from: 3, to: 2, y: 182, tone: "plain", text: "answer" },
  { from: 2, to: 1, y: 182, tone: "accent", text: "sealed answer" },
  { from: 1, to: 0, y: 182, tone: "accent", text: "sealed answer" },
] as const;

function Wide(p: string) {
  return (
    <>
      {PARTIES.map((party, i) => (
        <g key={party.title}>
          <Box
            x={X0 + i * STEP}
            y={16}
            w={COL_W}
            kicker={party.kicker}
            title={party.title}
            lines={[party.line]}
            tone={i === 1 || i === 2 ? "accent" : "plain"}
          />
          <path d={`M${cx(i)} 91 V244`} className="dg-life" />
          <Sees x={X0 + i * STEP} y={244} w={COL_W} party={party} />
        </g>
      ))}
      {MESSAGES.map((m) => {
        const dir = m.to > m.from ? 1 : -1;
        const x1 = cx(m.from) + dir * 6;
        const x2 = cx(m.to) - dir * 8;
        return (
          <g key={`${m.from}-${m.to}`}>
            <Wire d={`M${x1} ${m.y} H${x2}`} p={p} tone={m.tone} />
            <Pill x={(cx(m.from) + cx(m.to)) / 2} y={m.y} text={m.text} tone={m.tone} />
          </g>
        );
      })}
      <Note
        x={X0}
        y={424}
        lines={["The app pins the gateway's key (packages/net/src/constants.ts), so the relay cannot swap in its own."]}
        tone="quiet"
      />
    </>
  );
}

const CARD_H = 214;
const CARD_STEP = 278;
/** The tall drawing labels each hop once; its arrows point both ways. */
const HOPS = ["sealed both ways", "same sealed bytes", "HTTPS, from Ireland"];

function Tall(p: string) {
  return (
    <>
      {PARTIES.map((party, i) => {
        const y = 16 + i * CARD_STEP;
        return (
          <g key={party.title}>
            <Box
              x={16}
              y={y}
              w={328}
              h={CARD_H}
              kicker={party.kicker}
              title={party.title}
              lines={[party.line]}
              tone={i === 1 || i === 2 ? "accent" : "plain"}
            />
            <text x={30} y={y + 92} className="dg-kicker">
              {party.seesLabel ?? "SEES"}
            </text>
            <Note x={30} y={y + 112} lines={party.sees} />
            <text x={30} y={y + 156} className="dg-kicker">
              {party.neverLabel ?? "NEVER SEES"}
            </text>
            <Note x={30} y={y + 176} lines={party.never} />
            {i < PARTIES.length - 1 ? (
              <>
                <Wire d={`M180 ${y + CARD_H + 2} V${y + CARD_STEP - 2}`} p={p} tone={i < 2 ? "accent" : "plain"} both />
                <Pill
                  x={180}
                  y={y + CARD_H + (CARD_STEP - CARD_H) / 2}
                  text={HOPS[i] ?? ""}
                  tone={i < 2 ? "accent" : "plain"}
                />
              </>
            ) : null}
          </g>
        );
      })}
      <Note
        x={16}
        y={1094}
        lines={["The app pins the gateway's key, so the", "relay cannot swap in a key of its own."]}
        tone="quiet"
      />
    </>
  );
}

export function OhttpHops() {
  return (
    <Figure
      id="ohttp-hops"
      label="The two Oblivious HTTP hops. Your browser seals each request to the gateway's pinned key. The relay on Cloudflare sees your IP but not the content; the gateway on Vercel in Dublin sees the content but not your IP; the upstream sees one wallet's request from the gateway's address. Answers come back sealed the same way."
      caption="Requests go left to right and answers come back sealed. To read a request together with your IP, the relay and the gateway would have to share what they each see."
      wide={{ w: 840, h: 440, body: Wide }}
      tall={{ x: TALL_X, w: TALL_W, h: 1134, body: Tall }}
    />
  );
}

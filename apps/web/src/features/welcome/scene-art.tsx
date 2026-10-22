/**
 * The welcome's pictures: each scene is one of the product's own moments drawn with its own marks
 * (the money card, fresh wallets, the venues, the copy-trader's view, the trip home). Pure SVG,
 * coloured and animated by styles/welcome.css; a scene's keyframes restart when it mounts.
 */
import type { SceneKey } from "./copy";

const MARK = "/marks";

function ShieldedArt() {
  return (
    <svg viewBox="0 0 320 240" className="wl-art" aria-hidden>
      <circle cx="160" cy="118" r="104" className="wl-orbit wl-spin" />
      <g className="wl-rise">
        <rect x="58" y="62" width="204" height="112" rx="18" className="wl-money" />
        <text x="232" y="152" className="wl-stamp-glyph">
          隠
        </text>
        <image href={`${MARK}/ZEC.svg`} x="78" y="80" width="22" height="22" />
        <text x="108" y="96" className="wl-cap">
          Shielded ZEC
        </text>
        <g className="wl-blink">
          <circle cx="86" cy="138" r="6" className="wl-cream" />
          <circle cx="106" cy="138" r="6" className="wl-cream" />
          <circle cx="126" cy="138" r="6" className="wl-cream" />
          <circle cx="146" cy="138" r="6" className="wl-cream" />
        </g>
      </g>
      <g className="wl-pop">
        <circle cx="250" cy="66" r="18" className="wl-accent" />
        <rect x="243" y="64" width="14" height="11" rx="2.5" className="wl-on-accent" />
        <path d="M246 64 v-4 a4 4 0 0 1 8 0 v4" className="wl-on-accent-line" />
      </g>
    </svg>
  );
}

const FRESH = [
  { venue: "polymarket", addr: "0x4be1…a07c", turn: -9, x: 18 },
  { venue: "solana", addr: "7Hq2…Zp4N", turn: 9, x: 152 },
  { venue: "hyperliquid", addr: "0x91c2…3fd8", turn: 0, x: 85 },
] as const;

function FreshArt() {
  return (
    <svg viewBox="0 0 320 240" className="wl-art" aria-hidden>
      {FRESH.map((c, i) => (
        <g
          key={c.venue}
          className="wl-deal"
          style={{ animationDelay: `${i * 160}ms`, transform: `rotate(${c.turn}deg)`, transformOrigin: "160px 230px" }}
        >
          <rect x={c.x} y="70" width="150" height="96" rx="14" className="wl-card" />
          <image href={`${MARK}/venue-${c.venue}.svg`} x={c.x + 16} y="86" width="24" height="24" />
          <text x={c.x + 48} y="103" className="wl-mono">
            {c.addr}
          </text>
          <text x={c.x + 16} y="138" className="wl-mono wl-muted">
            History
          </text>
          <text x={c.x + 134} y="138" className="wl-mono wl-up wl-end">
            none
          </text>
          <rect x={c.x + 16} y="148" width="40" height="4" rx="2" className="wl-hair" />
        </g>
      ))}
    </svg>
  );
}

const VENUES = [
  { venue: "polymarket", label: "PREDICT", x: 64, y: 92 },
  { venue: "hyperliquid", label: "PERPS", x: 160, y: 66 },
  { venue: "solana", label: "TOKENS", x: 256, y: 92 },
] as const;

function VenuesArt() {
  return (
    <svg viewBox="0 0 320 240" className="wl-art" aria-hidden>
      <path d="M16 218 C 60 212, 84 192, 120 198 S 176 218, 208 194 S 262 168, 304 174" className="wl-line wl-draw" />
      {VENUES.map((v, i) => (
        <g key={v.venue} className="wl-pop" style={{ animationDelay: `${300 + i * 180}ms` }}>
          <circle cx={v.x} cy={v.y} r="30" className="wl-disc" />
          <image href={`${MARK}/venue-${v.venue}.svg`} x={v.x - 18} y={v.y - 18} width="36" height="36" />
          <text x={v.x} y={v.y + 50} className="wl-mono wl-muted wl-center">
            {v.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const ROWS = [
  ["Trades", "1"],
  ["Funded by", "NEAR swap"],
  ["Age", "4 min"],
] as const;

function PublicArt() {
  return (
    <svg viewBox="0 0 320 240" className="wl-art" aria-hidden>
      <g className="wl-rise">
        <rect x="48" y="44" width="224" height="178" rx="16" className="wl-card" />
        <text x="68" y="72" className="wl-mono wl-muted">
          WHAT THE PUBLIC SEES
        </text>
        <image href={`${MARK}/venue-polymarket.svg`} x="68" y="86" width="20" height="20" />
        <text x="96" y="101" className="wl-mono">
          0x4be1…a07c
        </text>
        {ROWS.map(([k, v], i) => (
          <g key={k}>
            <text x="68" y={132 + i * 22} className="wl-mono wl-muted">
              {k}
            </text>
            <text x="252" y={132 + i * 22} className="wl-mono wl-end">
              {v}
            </text>
          </g>
        ))}
        <text x="68" y="200" className="wl-mono wl-muted">
          Your other wallets
        </text>
        <text x="252" y="200" className="wl-mono wl-up wl-end">
          none
        </text>
      </g>
      <g className="wl-stamp">
        <rect x="184" y="12" width="112" height="40" rx="10" className="wl-stamp-box" />
        <text x="240" y="38" className="wl-stamp-text">
          NO LINK
        </text>
      </g>
    </svg>
  );
}

function HomeArt() {
  return (
    <svg viewBox="0 0 320 240" className="wl-art" aria-hidden>
      <path d="M244 70 C 220 10, 90 10, 76 128" className="wl-trail wl-draw" />
      <g className="wl-pop">
        <circle cx="252" cy="88" r="30" className="wl-disc" />
        <image href={`${MARK}/venue-hyperliquid.svg`} x="234" y="70" width="36" height="36" />
      </g>
      <g className="wl-pop" style={{ animationDelay: "1300ms" }}>
        <circle cx="76" cy="150" r="30" className="wl-disc wl-disc-home" />
        <image href={`${MARK}/ZEC.svg`} x="58" y="132" width="36" height="36" />
      </g>
      <g className="wl-receipt">
        <rect x="128" y="168" width="164" height="44" rx="12" className="wl-card" />
        <circle cx="150" cy="190" r="7" className="wl-ok" />
        <text x="166" y="195" className="wl-mono">
          +0.12 ZEC · shielded
        </text>
      </g>
    </svg>
  );
}

const ART: Record<SceneKey, () => React.JSX.Element> = {
  shielded: ShieldedArt,
  fresh: FreshArt,
  venues: VenuesArt,
  public: PublicArt,
  home: HomeArt,
};

export function SceneArt({ scene }: { scene: SceneKey }) {
  const Art = ART[scene];
  return <Art />;
}

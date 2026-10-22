"use client";

import { useState } from "react";
import { EventGrid } from "../polymarket/event-grid";
import { PerpsTable } from "./perps-table";

const VENUES = [
  { id: "predictions", label: "Predictions", by: "Polymarket" },
  { id: "perps", label: "Perps", by: "Hyperliquid" },
] as const;

type View = (typeof VENUES)[number]["id"];

/** Every market Mitoshi can trade privately, by venue. */
export function MarketsView() {
  const [view, setView] = useState<View>("predictions");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        {VENUES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`rounded-lg border px-4 py-2 text-left ${view === v.id ? "border-white" : "border-white/15 opacity-70"}`}
          >
            <span className="block font-medium">{v.label}</span>
            <span className="block text-xs opacity-60">{v.by}</span>
          </button>
        ))}
      </div>
      {view === "predictions" ? <EventGrid /> : <PerpsTable />}
    </div>
  );
}

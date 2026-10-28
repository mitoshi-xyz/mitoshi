"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { DEMO_VIDEO_ID, LANDING as L } from "./copy";

const COVER = { w: 1280, h: 720 };

/**
 * The recording behind its cover: nothing loads from YouTube until the visitor presses play, then a youtube-nocookie
 * player takes the cover's place and starts. YouTube refuses an embed that arrives without a referrer and the site
 * sends none, so the player alone sends this origin (scripts/headers.mjs lets /demo frame it).
 */
export function DemoPlayer() {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="lp-card relative aspect-video w-full max-w-[960px] overflow-hidden">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0&playsinline=1`}
          title={L.demo.playerTitle}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={L.demo.coverAlt}
      className="lp-card group relative block aspect-video w-full max-w-[960px] cursor-pointer overflow-hidden"
    >
      {/* The cover carries its own play button; the shade only answers the pointer. */}
      <img src="/demo/cover.webp" width={COVER.w} height={COVER.h} alt="" className="block size-full object-cover" />
      <span className="absolute inset-0 transition-colors group-hover:bg-[#050505]/20" aria-hidden />
      <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-[#050505]/75 px-3 py-1.5 font-semibold text-[14px] backdrop-blur">
        <Play size={14} /> {L.demo.watch}
      </span>
    </button>
  );
}

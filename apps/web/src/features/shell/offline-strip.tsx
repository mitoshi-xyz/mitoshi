"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/** "Offline": shown the moment the device loses its connection, gone when it is back. */
export function OfflineStrip() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const set = () => setOffline(!navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[var(--z-toast)] flex items-center justify-center gap-2 bg-warning px-4 py-1.5 font-medium text-[13px] text-bg"
    >
      <WifiOff size={14} /> Offline · prices and balances pause until you are back
    </div>
  );
}

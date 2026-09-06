"use client";

import { useEffect, useState } from "react";

export default function LiveCityTime({ timezone = "UTC" }: { timezone?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  let time = "--:--:--";
  let offset = "UTC";
  try {
    time = new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
    offset = new Intl.DateTimeFormat(undefined, { timeZone: timezone, timeZoneName: "shortOffset" }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value ?? "UTC";
  } catch { /* Invalid city data safely falls back to UTC display. */ }
  return <div aria-label={`Current time in ${timezone}`} className="text-sm font-semibold text-[var(--muted)]">{time} <span className="ml-1">{offset}</span></div>;
}

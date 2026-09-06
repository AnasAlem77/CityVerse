"use client";

import dynamic from "next/dynamic";

const CityMap = dynamic(() => import("./CityMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-3xl bg-[var(--secondary)]/10" />,
});

export default CityMap;

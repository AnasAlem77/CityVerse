import dynamic from "next/dynamic";

const PlaceMap = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse bg-[var(--secondary)]/10 sm:h-[340px]" />,
});

export default PlaceMap;

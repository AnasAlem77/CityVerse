import { MapPin } from "lucide-react";

export default function MediaFallback({ label = "Image unavailable" }: { label?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 via-emerald-100 to-slate-100 dark:from-orange-950 dark:via-emerald-950 dark:to-slate-950"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/50 bg-white/55 text-orange-500 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
        <MapPin size={38} strokeWidth={1.8} />
      </div>
    </div>
  );
}

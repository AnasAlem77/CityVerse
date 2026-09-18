import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Star,
} from "lucide-react";
import Rating from "../Rating/Rating";
import MediaFallback from "../MediaFallback/MediaFallback";

const isArabic = (text: string) =>
  /[\u0600-\u06FF]/.test(text);

type PlaceCardImage = {
  id: string;
  url?: string;
  imageUrl?: string;
};

type PlaceCardProps = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subtype?: string | null;
  address?: string | null;
  averageRating?: number;
  cityVerseScore?: number;
  images?: PlaceCardImage[];
};

export default function PlaceCard({
  id,
  name,
  description,
  category,
  subtype,
  address,
  averageRating = 0,
  cityVerseScore = 0,
  images = [],
}: PlaceCardProps) {
  const arabic = isArabic(name);
  const imageUrl =
    images[0]?.url ?? images[0]?.imageUrl;

  return (
    <Link
      href={`/places/${id}`}
      className="group block overflow-hidden rounded-3xl border border-black/5 bg-[var(--card)] shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl dark:border-white/10"
    >
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-orange-100 via-emerald-100 to-slate-100 dark:from-orange-950 dark:via-emerald-950 dark:to-slate-950">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${name} photo`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <>
            <MediaFallback
              label={`${name} image unavailable`}
            />

            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/40 bg-white/60 text-orange-500 shadow-xl backdrop-blur-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 dark:border-white/10 dark:bg-black/30">
              <MapPin
                size={38}
                strokeWidth={1.8}
              />
            </div>
          </>
        )}

        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-orange-400/20 blur-3xl transition-transform duration-700 group-hover:scale-150" />

        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl transition-transform duration-700 group-hover:scale-150" />

        <div className="absolute bottom-2 left-2 rounded-full border border-white/40 bg-white/80 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-800 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-black/40 dark:text-white sm:bottom-4 sm:left-4 sm:px-4 sm:py-2 sm:text-xs sm:tracking-wider">
          {subtype
            ? `${category} · ${subtype.replaceAll("_", " ")}`
            : category || "Place"}
        </div>

        {cityVerseScore > 0 && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md">
            <Star
              size={14}
              className="fill-yellow-400 text-yellow-400"
            />

            {Number(cityVerseScore).toFixed(1)}
          </div>
        )}
      </div>

      <div className="p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">
          {subtype
            ? `${category} · ${subtype.replaceAll("_", " ")}`
            : category || "Destination"}
        </p>

        <h3
          lang={arabic ? "ar" : "en"}
          dir={arabic ? "rtl" : "ltr"}
          className={`mt-2 text-2xl tracking-tight text-[var(--foreground)] transition-colors duration-300 group-hover:text-orange-500 ${
            arabic
              ? "font-arabic font-bold"
              : "font-black"
          }`}
        >
          {name}
        </h3>

        {address && (
          <div className="mt-3 flex items-start gap-2 text-sm leading-6 text-[var(--muted)]">
            <MapPin
              size={16}
              className="mt-1 shrink-0 text-orange-500"
            />

            <span
              lang={
                isArabic(address)
                  ? "ar"
                  : "en"
              }
              dir={
                isArabic(address)
                  ? "rtl"
                  : "ltr"
              }
              className={
                isArabic(address)
                  ? "font-arabic"
                  : ""
              }
            >
              {address}
            </span>
          </div>
        )}

        {description && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--foreground)]">
            View place
          </span>

          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 transition-all duration-500 group-hover:translate-x-1 group-hover:bg-orange-500 group-hover:text-white">
            <ArrowRight size={18} />
          </span>
        </div>
      </div>
    </Link>
  );
}
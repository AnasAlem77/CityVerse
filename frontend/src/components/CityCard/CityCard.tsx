import Link from "next/link";
import { ArrowRight, Compass, MapPin } from "lucide-react";

type CityCardProps = {
  id: string;
  name: string;
  country: string;
  description?: string;
};

export default function CityCard({
  id,
  name,
  country,
  description,
}: CityCardProps) {
  return (
    <Link
      href={`/cities/${id}`}
      className="
        group
        block
        overflow-hidden
        rounded-3xl
        border
        border-black/5
        bg-[var(--card)]
        shadow-sm
        transition-all
        duration-500
        hover:-translate-y-2
        hover:shadow-2xl
        dark:border-white/10
      "
    >
      {/* Visual area */}
      <div
        className="
          relative
          flex
          h-52
          items-center
          justify-center
          overflow-hidden
          bg-gradient-to-br
          from-orange-100
          via-emerald-100
          to-slate-100
          dark:from-orange-950
          dark:via-emerald-950
          dark:to-slate-950
        "
      >
        {/* Glow */}
        <div
          className="
            absolute
            -right-10
            -top-10
            h-32
            w-32
            rounded-full
            bg-orange-400/20
            blur-3xl
            transition-transform
            duration-700
            group-hover:scale-150
          "
        />

        <div
          className="
            absolute
            -bottom-10
            -left-10
            h-32
            w-32
            rounded-full
            bg-emerald-400/20
            blur-3xl
            transition-transform
            duration-700
            group-hover:scale-150
          "
        />

        {/* Compass */}
        <div
          className="
            relative
            flex
            h-20
            w-20
            items-center
            justify-center
            rounded-3xl
            border
            border-white/40
            bg-white/60
            text-orange-500
            shadow-xl
            backdrop-blur-xl
            transition-transform
            duration-500
            group-hover:scale-110
            group-hover:rotate-3
            dark:border-white/10
            dark:bg-black/30
          "
        >
          <Compass size={38} strokeWidth={1.8} />
        </div>

        {/* Country badge */}
        <div
          className="
            absolute
            bottom-4
            left-4
            flex
            items-center
            gap-2
            rounded-full
            border
            border-white/40
            bg-white/80
            px-4
            py-2
            text-sm
            font-bold
            text-slate-800
            shadow-lg
            backdrop-blur-md
            dark:border-white/10
            dark:bg-black/40
            dark:text-white
          "
        >
          <MapPin size={14} className="text-orange-500" />
          {country}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">
          Destination
        </p>

        <h3
          className="
            mt-2
            text-2xl
            font-black
            tracking-tight
            text-[var(--foreground)]
            transition-colors
            duration-300
            group-hover:text-orange-500
          "
        >
          {name}
        </h3>

        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
          {description ??
            "Discover amazing places and experiences in this city."}
        </p>

        {/* Bottom */}
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--foreground)]">
            Explore city
          </span>

          <span
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              bg-orange-500/10
              text-orange-500
              transition-all
              duration-500
              group-hover:bg-orange-500
              group-hover:text-white
              group-hover:translate-x-1
            "
          >
            <ArrowRight size={18} />
          </span>
        </div>
      </div>
    </Link>
  );
}

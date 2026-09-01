import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

type CityCardProps = {
  id: string;
  name: string;
  country: string;
  description?: string;
  image: string;
};

export default function CityCard({
  id,
  name,
  country,
  description,
  image,
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
      {/* Image */}
      <div className="relative h-60 overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          className="
            object-cover
            transition-transform
            duration-700
            group-hover:scale-105
          "
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Image overlay */}
        <div
          className="
            absolute
            inset-0
            bg-gradient-to-t
            from-black/60
            via-black/10
            to-transparent
          "
        />

        {/* Country */}
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
            border-white/30
            bg-black/30
            px-4
            py-2
            text-sm
            font-bold
            text-white
            shadow-lg
            backdrop-blur-md
          "
        >
          <MapPin size={14} className="text-orange-400" />
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
              group-hover:translate-x-1
              group-hover:bg-orange-500
              group-hover:text-white
            "
          >
            <ArrowRight size={18} />
          </span>
        </div>
      </div>
    </Link>
  );
}
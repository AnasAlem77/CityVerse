import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import MediaFallback from "../MediaFallback/MediaFallback";

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
        min-w-0
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
      <div className="relative h-40 overflow-hidden sm:h-60">
        {image ? <Image src={image} alt={name} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw" /> : <MediaFallback label={`${name} image unavailable`} />}

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
            bottom-2
            left-2
            flex
            items-center
            gap-2
            rounded-full
            border
            border-white/30
            bg-black/30
            px-2.5
            py-1.5
            text-xs
            font-bold
            text-white
            shadow-lg
            backdrop-blur-md
          "
        >
          <MapPin size={12} className="text-orange-400 sm:h-[14px] sm:w-[14px]" />
          {country}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">
          Destination
        </p>

        <h3
          className="
            mt-2
            text-lg
            sm:text-2xl
            font-black
            tracking-tight
            text-[var(--foreground)]
            break-words
            transition-colors
            duration-300
            group-hover:text-orange-500
          "
        >
          {name}
        </h3>

        <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--muted)] sm:mt-3 sm:text-sm sm:leading-6">
          {description ??
            "Discover amazing places and experiences in this city."}
        </p>

        {/* Bottom */}
        <div className="mt-4 flex items-center justify-between sm:mt-6">
          <span className="text-xs font-bold text-[var(--foreground)] sm:text-sm">
            Explore city
          </span>

          <span
            className="
              flex
              h-8
              w-8
              sm:h-10
              sm:w-10
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
            <ArrowRight size={16} className="sm:h-[18px] sm:w-[18px]" />
          </span>
        </div>
      </div>
    </Link>
  );
}

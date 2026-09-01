"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useState,
  useEffect,
} from "react";
import {
  ArrowRight,
  MapPin,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FeaturedCities from "@/components/FeaturedCities";

type City = {
  id: string;
  name: string;
  country: string;
  description: string;
  image: string;
  featuredOrder: number;
};

export default function Hero({
  cities,
}: {
  cities: City[];
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [activeCity, setActiveCity] = useState(0);

  useEffect(() => {
    if (!cities.length) return;

    const timer = setInterval(() => {
      setActiveCity((prev) => (prev + 1) % cities.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [cities]);

  const city = cities[activeCity];

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = query.trim();

    if (!value) return;

    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  /*
   * ============================================================
   * CITY IMAGE MAPPING
   * ============================================================
   *
   * Images are located inside:
   * public/images/
   *
   * Each city has its own specific image mapping.
   */

  function getCityImage(city: City) {
    const name = city.name.toLowerCase().trim();

    if (name.includes("paris")) {
      return "/images/paris.jpg";
    }

    if (name.includes("london")) {
      return "/images/london.jpg";
    }

    if (name.includes("tokyo")) {
      return "/images/tokyo.jpg";
    }

    if (name.includes("dubai")) {
      return "/images/dubai.jpg";
    }

    if (name.includes("jakarta")) {
      return "/images/jakarta.jpg";
    }

    // Fallback to city image data if no specific match is found
    return city.image;
  }

  return (
    <>
      <section className="relative isolate min-h-[calc(100svh-80px)] overflow-hidden">

        {/* =====================================================
            BACKGROUND — Static Paris Hero Image
        ===================================================== */}

        <div className="absolute inset-0 -z-20">

          <img
            src="/images/paris-hero.jpg"
            alt="Paris cityscape"
            className="
              absolute
              inset-0
              h-full
              w-full
              object-cover
              object-center
              scale-[1.06]
              blur-[4px]
              brightness-[0.92]
              saturate-[0.85]
              transition-all
              duration-1000
              dark:brightness-[0.75]
              dark:saturate-[0.85]
            "
          />

          {/* Light / Dark atmosphere */}

          <div
            className="
              absolute
              inset-0
              bg-[rgba(244,241,235,0.28)]
              backdrop-blur-[1px]
              dark:bg-[rgba(8,18,34,0.68)]
              dark:backdrop-blur-[3px]
            "
          />

          {/* Cinematic gradient */}

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-r
              from-[#f4f1eb]/80
              via-[#f4f1eb]/45
              to-transparent
              dark:from-[#081222]/95
              dark:via-[#081222]/62
              dark:to-transparent
            "
          />

          {/* Bottom fade */}

          <div
            className="
              absolute
              inset-x-0
              bottom-0
              h-48
              bg-gradient-to-t
              from-[#f4f1eb]
              to-transparent
              dark:from-[#0b1220]
            "
          />

          {/* Warm cinematic glow */}

          <div
            className="
              absolute
              left-[8%]
              top-[18%]
              h-64
              w-64
              rounded-full
              bg-orange-400/15
              blur-[100px]
              dark:bg-orange-400/10
            "
          />

        </div>

        {/* =====================================================
            CONTENT
        ===================================================== */}

        <div className="mx-auto flex min-h-[calc(100svh-80px)] max-w-7xl items-center px-5 py-16 sm:px-6 lg:px-8">

          <div className="grid w-full items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">

            {/* =================================================
                LEFT
            ================================================= */}

            <div className="max-w-3xl">

              {/* Badge */}

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65 }}
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-white/50
                  bg-white/35
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-stone-700
                  shadow-lg
                  backdrop-blur-xl
                  dark:border-white/10
                  dark:bg-slate-900/35
                  dark:text-slate-200
                "
              >
                <Sparkles
                  size={16}
                  className="text-orange-500"
                />

                Discover somewhere new
              </motion.div>

              {/* Heading */}

              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.75,
                  delay: 0.1,
                }}
                className="
                  mt-7
                  max-w-4xl
                  text-5xl
                  font-black
                  leading-[0.96]
                  tracking-[-0.055em]
                  text-stone-900
                  sm:text-6xl
                  md:text-7xl
                  lg:text-[5.4rem]
                  dark:text-white
                "
              >
                Explore cities.

                <br />

                <span className="gradient-text">
                  Find your place.
                </span>
              </motion.h1>

              {/* Description */}

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.25,
                }}
                className="
                  mt-7
                  max-w-2xl
                  text-base
                  leading-7
                  text-stone-700
                  sm:text-lg
                  sm:leading-8
                  dark:text-slate-300
                "
              >
                Discover remarkable cities, hidden places,
                local experiences, and stories shared by
                people who have been there.
              </motion.p>

              {/* Search */}

              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.4,
                }}
                onSubmit={handleSearch}
                className="mt-8 max-w-2xl"
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                    rounded-[1.35rem]
                    border
                    border-white/60
                    bg-white/50
                    p-2
                    shadow-[0_25px_80px_rgba(50,40,25,0.16)]
                    backdrop-blur-2xl
                    transition-all
                    duration-300
                    focus-within:border-orange-400/70
                    focus-within:bg-white/65
                    dark:border-white/10
                    dark:bg-slate-900/50
                    dark:focus-within:bg-slate-900/65
                  "
                >
                  <div
                    className="
                      flex
                      h-12
                      w-12
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      bg-orange-500/15
                      text-orange-600
                      dark:bg-orange-400/10
                      dark:text-orange-400
                    "
                  >
                    <Search size={21} />
                  </div>

                  <input
                    type="search"
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value)
                    }
                    placeholder="Search a city, place, or experience..."
                    className="
                      min-w-0
                      flex-1
                      bg-transparent
                      px-1
                      text-sm
                      text-stone-900
                      outline-none
                      placeholder:text-stone-500
                      sm:text-base
                      dark:text-white
                      dark:placeholder:text-slate-500
                    "
                  />

                  <button
                    type="submit"
                    className="
                      hidden
                      shrink-0
                      items-center
                      gap-2
                      rounded-xl
                      bg-stone-900
                      px-5
                      py-3
                      text-sm
                      font-bold
                      text-white
                      transition-all
                      duration-300
                      hover:-translate-y-0.5
                      hover:bg-orange-600
                      sm:flex
                      dark:bg-white
                      dark:text-slate-900
                      dark:hover:bg-orange-400
                    "
                  >
                    Search

                    <ArrowRight size={16} />
                  </button>
                </div>

                <p
                  className="
                    mt-3
                    pl-2
                    text-xs
                    text-stone-500
                    dark:text-slate-500
                  "
                >
                  Press Enter to explore
                </p>
              </motion.form>

              {/* CTA */}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.5,
                }}
                className="mt-7 flex flex-wrap gap-3"
              >
                <Link
                  href="/cities"
                  className="
                    group
                    inline-flex
                    items-center
                    gap-2
                    rounded-xl
                    bg-[#D96C2C]
                    px-6
                    py-3.5
                    text-sm
                    font-bold
                    text-white
                    shadow-[0_15px_40px_rgba(217,108,44,0.28)]
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:bg-[#C45D24]
                    hover:shadow-[0_20px_50px_rgba(217,108,44,0.35)]
                  "
                >
                  Explore Cities

                  <ArrowRight
                    size={17}
                    className="
                      transition-transform
                      duration-300
                      group-hover:translate-x-1
                    "
                  />
                </Link>

                <Link
                  href="/places"
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-xl
                    border
                    border-white/60
                    bg-white/35
                    px-6
                    py-3.5
                    text-sm
                    font-bold
                    text-stone-800
                    backdrop-blur-xl
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:bg-white/60
                    dark:border-white/10
                    dark:bg-slate-900/40
                    dark:text-white
                    dark:hover:bg-slate-900/65
                  "
                >
                  Browse Places
                </Link>
              </motion.div>

              {/* Stats */}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.65,
                }}
                className="
                  mt-9
                  flex
                  flex-wrap
                  items-center
                  gap-5
                  text-sm
                  text-stone-600
                  dark:text-slate-400
                "
              >
                <div className="flex items-center gap-2">
                  <MapPin
                    size={17}
                    className="text-orange-500"
                  />

                  Explore destinations
                </div>

                <div
                  className="
                    hidden
                    h-4
                    w-px
                    bg-stone-400/40
                    sm:block
                    dark:bg-slate-500/30
                  "
                />

                <div className="flex items-center gap-2">
                  <Star
                    size={17}
                    className="fill-amber-400 text-amber-400"
                  />

                  Real traveler reviews
                </div>
              </motion.div>

            </div>

            {/* =================================================
                RIGHT — CITY CARD
            ================================================= */}

            <div className="relative hidden h-[560px] lg:block">

              {city && (
                <div className="absolute right-4 top-8 w-[390px]">

                  <AnimatePresence mode="wait">

                    <motion.div
                      key={city.id}
                      initial={{
                        opacity: 0,
                        y: 30,
                        scale: 0.96,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        y: -20,
                        scale: 0.98,
                      }}
                      transition={{
                        duration: 0.8,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >

                      <Link href={`/cities/${city.id}`}>

                        <div
                          className="
                            overflow-hidden
                            rounded-[2rem]
                            border
                            border-white/50
                            bg-white/45
                            shadow-[0_30px_100px_rgba(40,35,25,0.2)]
                            backdrop-blur-2xl
                            dark:border-white/10
                            dark:bg-slate-900/45
                          "
                        >

                          {/* =================================================
                              CITY IMAGE
                          ================================================= */}

                          <div className="relative h-60 overflow-hidden">

                            <img
                              src={getCityImage(city)}
                              alt={city.name}
                              className="
                                h-full
                                w-full
                                object-cover
                                brightness-[0.88]
                                saturate-[0.9]
                                dark:brightness-[0.65]
                                transition-all
                                duration-500
                                hover:scale-105
                              "
                            />

                            <div
                              className="
                                absolute
                                inset-0
                                bg-gradient-to-t
                                from-black/55
                                via-black/5
                                to-transparent
                              "
                            />

                            <div
                              className="
                                absolute
                                bottom-5
                                left-5
                                flex
                                items-center
                                gap-2
                                rounded-full
                                border
                                border-white/30
                                bg-black/20
                                px-4
                                py-2
                                text-sm
                                font-bold
                                text-white
                                backdrop-blur-xl
                              "
                            >
                              <MapPin size={15} />

                              {city.name}, {city.country}
                            </div>

                          </div>

                          {/* =================================================
                              CARD CONTENT
                          ================================================= */}

                          <div className="p-6">

                            <p
                              className="
                                text-xs
                                font-bold
                                uppercase
                                tracking-[0.18em]
                                text-orange-500
                              "
                            >
                              Featured destination
                            </p>

                            <div
                              className="
                                mt-2
                                flex
                                items-center
                                justify-between
                                gap-4
                              "
                            >

                              <h3
                                className="
                                  text-3xl
                                  font-black
                                  tracking-tight
                                  text-stone-900
                                  dark:text-white
                                "
                              >
                                {city.name}
                              </h3>

                              <div
                                className="
                                  flex
                                  items-center
                                  gap-1
                                  rounded-full
                                  bg-amber-400/15
                                  px-3
                                  py-1.5
                                  text-sm
                                  font-bold
                                  text-amber-700
                                  dark:text-amber-300
                                "
                              >
                                <Star
                                  size={14}
                                  className="fill-current"
                                />

                                4.9
                              </div>

                            </div>

                            <p
                              className="
                                mt-2
                                text-sm
                                leading-6
                                text-stone-600
                                dark:text-slate-400
                                line-clamp-3
                              "
                            >
                              {city.description}
                            </p>

                          </div>

                        </div>

                      </Link>

                    </motion.div>

                  </AnimatePresence>

                  {/* =================================================
                      CITY INDICATORS
                  ================================================= */}

                  <div className="mt-4 flex items-center justify-center gap-2">

                    {cities.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveCity(index)}
                        className={`
                          h-1.5
                          rounded-full
                          transition-all
                          duration-500
                          ${
                            index === activeCity
                              ? "w-8 bg-orange-500"
                              : "w-2 bg-stone-300/70 dark:bg-slate-700"
                          }
                        `}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}

                  </div>

                </div>
              )}

            </div>

          </div>

        </div>

      </section>

      <FeaturedCities cities={cities} />
    </>
  );
}
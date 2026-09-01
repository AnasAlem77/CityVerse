"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { motion } from "framer-motion";

type City = {
  id: string;
  name: string;
  country: string;
  description: string;
  image: string;
  featuredOrder: number;
};

function getCityImage(city: City) {
  const name = city.name.toLowerCase().trim();

  if (name.includes("paris")) return "/images/paris.jpg";
  if (name.includes("london")) return "/images/london.jpg";
  if (name.includes("tokyo")) return "/images/tokyo.jpg";
  if (name.includes("dubai")) return "/images/dubai.jpg";
  if (name.includes("jakarta")) return "/images/jakarta.jpg";

  return city.image;
}

export default function FeaturedCities({
  cities,
}: {
  cities: City[];
}) {
  const featuredCities = [...cities]
    .sort((a, b) => a.featuredOrder - b.featuredOrder)
    .slice(0, 5);

  return (
    <section className="bg-[#f4f1eb] px-5 py-24 dark:bg-[#0b1220] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
          className="mb-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
              Featured destinations
            </p>

            <h2 className="text-4xl font-black tracking-tight text-stone-900 dark:text-white sm:text-5xl">
              Places worth
              <br />
              <span className="gradient-text">discovering.</span>
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 dark:text-slate-400">
              Explore some of the world's most interesting cities,
              from iconic landmarks to places waiting to be discovered.
            </p>
          </div>

          <Link
            href="/cities"
            className="
              group
              inline-flex
              w-fit
              items-center
              gap-2
              rounded-xl
              border
              border-stone-300/70
              bg-white/50
              px-5
              py-3
              text-sm
              font-bold
              text-stone-800
              backdrop-blur-xl
              transition-all
              duration-300
              hover:-translate-y-1
              hover:bg-white
              dark:border-white/10
              dark:bg-slate-900/50
              dark:text-white
              dark:hover:bg-slate-900
            "
          >
            View all cities
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </motion.div>

        {/* City Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featuredCities.map((city, index) => (
            <motion.div
              key={city.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: 0.65,
                delay: index * 0.08,
              }}
              className={`
                group
                ${index === 0 ? "lg:col-span-2" : ""}
              `}
            >
              <Link href={`/cities/${city.id}`}>
                <article
                  className="
                    relative
                    h-[360px]
                    overflow-hidden
                    rounded-[1.75rem]
                    border
                    border-white/50
                    bg-white
                    shadow-[0_20px_60px_rgba(40,35,25,0.10)]
                    transition-all
                    duration-500
                    hover:-translate-y-1
                    hover:shadow-[0_30px_80px_rgba(40,35,25,0.18)]
                    dark:border-white/10
                    dark:bg-slate-900
                  "
                >
                  {/* Image */}
                  <img
                    src={getCityImage(city)}
                    alt={city.name}
                    className="
                      absolute
                      inset-0
                      h-full
                      w-full
                      object-cover
                      transition-transform
                      duration-700
                      group-hover:scale-105
                    "
                  />

                  {/* Overlay */}
                  <div
                    className="
                      absolute
                      inset-0
                      bg-gradient-to-t
                      from-black/80
                      via-black/25
                      to-transparent
                    "
                  />

                  {/* Top badge */}
                  <div className="absolute left-5 top-5">
                    <span
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-full
                        border
                        border-white/20
                        bg-black/20
                        px-3
                        py-1.5
                        text-xs
                        font-semibold
                        text-white
                        backdrop-blur-xl
                      "
                    >
                      <MapPin size={13} />
                      Featured
                    </span>
                  </div>

                  {/* Content */}
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="mb-1 text-sm font-medium text-white/70">
                          {city.country}
                        </p>

                        <h3 className="text-3xl font-black tracking-tight text-white">
                          {city.name}
                        </h3>
                      </div>

                      <div
                        className="
                          flex
                          shrink-0
                          items-center
                          gap-1
                          rounded-full
                          bg-white/15
                          px-3
                          py-1.5
                          text-sm
                          font-bold
                          text-white
                          backdrop-blur-xl
                        "
                      >
                        <Star
                          size={14}
                          className="fill-amber-400 text-amber-400"
                        />
                        4.9
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/75">
                      {city.description}
                    </p>

                    <div
                      className="
                        mt-4
                        flex
                        items-center
                        gap-2
                        text-sm
                        font-bold
                        text-white
                        opacity-0
                        transition-all
                        duration-300
                        group-hover:translate-x-1
                        group-hover:opacity-100
                      "
                    >
                      Explore city
                      <ArrowRight size={15} />
                    </div>
                  </div>
                </article>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
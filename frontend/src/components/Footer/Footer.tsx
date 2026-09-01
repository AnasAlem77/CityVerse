import Link from "next/link";
import { Compass } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="
        border-t
        border-stone-300/30
        bg-[#F4F1EB]
        transition-colors
        duration-500
        dark:border-slate-700/30
        dark:bg-[#0B1220]
      "
    >
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div
          className="
            flex
            flex-col
            gap-6
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          {/* Brand */}
          <Link
            href="/"
            className="group inline-flex items-center gap-3"
          >
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-[#D96C2C]
                text-white
                shadow-lg
                shadow-[#D96C2C]/15
                transition-all
                duration-300
                group-hover:-translate-y-0.5
                group-hover:shadow-xl
                dark:bg-[#E98245]
                dark:text-[#0B1220]
                dark:shadow-[#E98245]/10
              "
            >
              <Compass size={20} />
            </div>

            <div>
              <p
                className="
                  text-lg
                  font-black
                  tracking-tight
                  text-stone-900
                  dark:text-white
                "
              >
                City
                <span className="text-[#D96C2C] dark:text-[#E98245]">
                  Verse
                </span>
              </p>

              <p
                className="
                  text-[10px]
                  font-medium
                  text-stone-500
                  dark:text-slate-500
                "
              >
                Explore beyond limits
              </p>
            </div>
          </Link>

          {/* Center */}
          <p
            className="
              hidden
              text-sm
              font-medium
              text-stone-500
              md:block
              dark:text-slate-500
            "
          >
            Discover. Explore. Experience.
          </p>
        </div>

        {/* Bottom */}
        <div
          className="
            mt-7
            flex
            flex-col
            gap-2
            border-t
            border-stone-300/30
            pt-5
            text-xs
            text-stone-500
            sm:flex-row
            sm:items-center
            sm:justify-between
            dark:border-slate-700/30
            dark:text-slate-500
          "
        >
          <p>
            © 2026 CityVerse. All rights reserved.
          </p>

          <p>
            Author by{" "}
            <Link
              href="https://github.com/AnasAlem77"
              target="_blank"
              rel="noopener noreferrer"
              className="
                font-semibold
                text-stone-700
                transition-colors
                duration-300
                hover:text-[#D96C2C]
                dark:text-slate-300
                dark:hover:text-[#E98245]
              "
            >
              Anas Alem
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
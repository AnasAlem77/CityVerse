import Link from "next/link";
import { Compass, MapPin, Heart } from "lucide-react";

const footerLinks = [
  {
    title: "Explore",
    links: [
      { name: "Home", href: "/" },
      { name: "Cities", href: "/cities" },
      { name: "Places", href: "/places" },
    ],
  },
  {
    title: "CityVerse",
    links: [
      { name: "Login", href: "/login" },
      { name: "Profile", href: "/profile" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-3"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Compass size={23} />
              </div>

              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                City<span className="text-blue-600">Verse</span>
              </span>
            </Link>

            <p className="mt-5 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
              Discover amazing cities, explore beautiful places, read reviews,
              and save the destinations you love.
            </p>

            <div className="mt-6 flex items-center gap-5 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-2">
                <MapPin size={16} />
                Explore the world
              </span>

              <span className="flex items-center gap-2">
                <Heart size={16} />
                Save your favorites
              </span>
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {section.title}
              </h3>

              <ul className="mt-5 space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-14 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <p className="text-slate-500 dark:text-slate-400">
            © 2026 CityVerse. All rights reserved.
          </p>

          <p className="text-slate-500 dark:text-slate-400">
            Discover. Explore. Experience.
          </p>

          <Link
            href="https://github.com/AnasAlem77"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          >
            Author by AnasAlem
          </Link>
        </div>
      </div>
    </footer>
  );
}

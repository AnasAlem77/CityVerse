"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Compass,
  Heart,
  LogIn,
  LogOut,
  Menu,
  User,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import ThemeToggle from "../ThemeToggle/ThemeToggle";

type UserData = {
  id: string;
  email: string;
  name: string;
};

const links = [
  {
    name: "Home",
    href: "/",
  },
  {
    name: "Cities",
    href: "/cities",
  },
  {
    name: "Places",
    href: "/places",
  },
];

export default function Navbar() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const loadUser = () => {
      const storedUser = localStorage.getItem("cityverse_user");

      if (!storedUser) {
        setUser(null);
        return;
      }

      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    };

    loadUser();

    window.addEventListener("storage", loadUser);

    return () => {
      window.removeEventListener("storage", loadUser);
    };
  }, []);

  function logout() {
    localStorage.removeItem("cityverse_token");
    localStorage.removeItem("cityverse_user");

    setUser(null);
    setMobileOpen(false);

    router.push("/");
    router.refresh();
  }

  return (
    <nav
      className="
        sticky top-0 z-50
        border-b border-slate-200/80
        bg-white/90
        backdrop-blur-xl
        transition-colors
        dark:border-slate-800
        dark:bg-slate-950/90
      "
    >
      <div
        className="
          mx-auto flex h-18 max-w-7xl
          items-center justify-between
          px-5 sm:px-6
        "
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <motion.div
            whileHover={{
              rotate: 6,
              scale: 1.04,
            }}
            transition={{
              duration: 0.2,
            }}
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              bg-blue-600
              text-white
              shadow-md
              shadow-blue-600/20
            "
          >
            <Compass size={21} />
          </motion.div>

          <div>
            <p
              className="
                text-lg font-black tracking-tight
                text-slate-900
                dark:text-white
              "
            >
              City
              <span className="text-blue-600 dark:text-blue-400">
                Verse
              </span>
            </p>

            <p className="hidden text-[10px] text-slate-400 sm:block">
              Explore beyond limits
            </p>
          </div>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="
                text-sm font-semibold
                text-slate-600
                transition-colors
                hover:text-blue-600
                dark:text-slate-300
                dark:hover:text-blue-400
              "
            >
              {link.name}
            </Link>
          ))}

          {user && (
            <Link
              href="/profile"
              className="
                flex items-center gap-2
                text-sm font-semibold
                text-slate-600
                transition-colors
                hover:text-blue-600
                dark:text-slate-300
                dark:hover:text-blue-400
              "
            >
              <User size={17} />
              {user.name}
            </Link>
          )}

          {user && (
            <Link
              href="/profile"
              aria-label="Saved places"
              className="
                text-slate-500
                transition-colors
                hover:text-pink-500
                dark:text-slate-400
              "
            >
              <Heart size={19} />
            </Link>
          )}

          <ThemeToggle />

          {!user ? (
            <Link
              href="/login"
              className="
                flex items-center gap-2
                rounded-xl
                bg-blue-600
                px-4 py-2.5
                text-sm font-bold
                text-white
                shadow-sm
                transition-all
                hover:-translate-y-0.5
                hover:bg-blue-700
                hover:shadow-md
              "
            >
              <LogIn size={17} />
              Login
            </Link>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="
                flex items-center gap-2
                rounded-xl
                border border-slate-200
                px-4 py-2.5
                text-sm font-bold
                text-slate-600
                transition-all
                hover:border-red-200
                hover:bg-red-50
                hover:text-red-600
                dark:border-slate-700
                dark:text-slate-300
                dark:hover:border-red-900
                dark:hover:bg-red-950/30
                dark:hover:text-red-400
              "
            >
              <LogOut size={17} />
              Logout
            </button>
          )}
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              border border-slate-200
              text-slate-700
              transition
              hover:border-blue-300
              hover:text-blue-600
              dark:border-slate-700
              dark:text-slate-200
            "
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: "auto",
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            className="
              overflow-hidden
              border-t border-slate-200
              bg-white
              dark:border-slate-800
              dark:bg-slate-950
              md:hidden
            "
          >
            <div className="flex flex-col gap-1 p-4">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="
                    rounded-xl px-4 py-3
                    text-sm font-semibold
                    text-slate-700
                    transition
                    hover:bg-slate-100
                    hover:text-blue-600
                    dark:text-slate-200
                    dark:hover:bg-slate-900
                    dark:hover:text-blue-400
                  "
                >
                  {link.name}
                </Link>
              ))}

              {user && (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="
                      flex items-center gap-3
                      rounded-xl px-4 py-3
                      text-sm font-semibold
                      text-slate-700
                      hover:bg-slate-100
                      dark:text-slate-200
                      dark:hover:bg-slate-900
                    "
                  >
                    <User size={17} />
                    Profile
                  </Link>

                  <button
                    type="button"
                    onClick={logout}
                    className="
                      flex items-center gap-3
                      rounded-xl px-4 py-3
                      text-left text-sm font-semibold
                      text-red-600
                      hover:bg-red-50
                      dark:text-red-400
                      dark:hover:bg-red-950/30
                    "
                  >
                    <LogOut size={17} />
                    Logout
                  </button>
                </>
              )}

              {!user && (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="
                    mt-2 flex items-center justify-center gap-2
                    rounded-xl
                    bg-blue-600
                    px-4 py-3
                    text-sm font-bold
                    text-white
                    hover:bg-blue-700
                  "
                >
                  <LogIn size={17} />
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

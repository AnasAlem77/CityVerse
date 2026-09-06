"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Compass,
  Heart,
  LogOut,
  Mail,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import PlaceCard from "@/components/PlaceCard/PlaceCard";
import { getSavedPlaces, removeSavedPlace, SavedPlace } from "@/lib/api";

type UserData = {
  id: string;
  email: string;
  name: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("cityverse_user");

    if (!storedUser) {
      router.push("/login");
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
      getSavedPlaces()
        .then(setSavedPlaces)
        .catch((error) => setSavedError(error instanceof Error ? error.message : "Unable to load saved places."))
        .finally(() => setSavedLoading(false));
    } catch {
      localStorage.removeItem("cityverse_user");
      localStorage.removeItem("cityverse_token");
      router.push("/login");
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("cityverse_token");
    localStorage.removeItem("cityverse_user");

    router.push("/");
    router.refresh();
  }

  async function removeSaved(placeId: string) {
    try {
      await removeSavedPlace(placeId);
      setSavedPlaces((current) => current.filter((item) => item.place.id !== placeId));
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Unable to remove saved place.");
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-sm text-[var(--muted)]">
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link
          href="/"
          className="
            inline-flex items-center gap-2
            text-sm font-semibold
            text-slate-500
            transition-colors
            hover:text-blue-600
            dark:text-slate-400
            dark:hover:text-blue-400
          "
        >
          <ArrowLeft size={17} />
          Back to home
        </Link>

        <section
          className="
            mt-8 overflow-hidden
            rounded-3xl
            border border-slate-200
            bg-white
            shadow-sm
            dark:border-slate-800
            dark:bg-slate-900
          "
        >
          <div className="h-32 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]" />

          <div className="px-6 pb-7 sm:px-8">
            <div
              className="
                -mt-12 flex h-24 w-24
                items-center justify-center
                rounded-3xl
                border-4 border-white
                bg-orange-50
                text-3xl font-black
                text-[var(--primary)]
                shadow-md
                dark:border-slate-900
                dark:bg-slate-800
                dark:text-[var(--primary)]
              "
            >
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div className="mt-5">
              <h1 className="text-3xl font-black text-[var(--foreground)]">
                {user.name}
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                CityVerse Explorer
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Mail size={19} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Email
                    </p>

                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <User size={19} />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Account
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      Active member
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Link
                href="/places"
                className="
                  flex items-center gap-4
                  rounded-2xl
                  border border-slate-200
                  p-5
                  transition-all
                  hover:-translate-y-0.5
                  hover:border-blue-300
                  hover:bg-blue-50
                  dark:border-slate-700
                  dark:hover:border-blue-800
                  dark:hover:bg-blue-950/30
                "
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Compass size={20} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    Explore Places
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Discover new destinations
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => document.getElementById("saved-places")?.scrollIntoView({ behavior: "smooth" })}
                className="
                  flex items-center gap-4
                  rounded-2xl
                  border border-slate-200
                  p-5 text-left
                  transition-all
                  hover:-translate-y-0.5
                  hover:border-pink-300
                  hover:bg-pink-50
                  dark:border-slate-700
                  dark:hover:border-pink-900
                  dark:hover:bg-pink-950/20
                "
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400">
                  <Heart size={20} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    Saved Places
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Your favorite destinations
                  </p>
                </div>
              </button>
            </div>

            <section id="saved-places" className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Your collection</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Saved Places</h2>
                </div>
                {!savedLoading && <span className="text-sm text-slate-500 dark:text-slate-400">{savedPlaces.length} saved</span>}
              </div>

              {savedLoading ? (
                <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading saved places...</p>
              ) : savedError ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">{savedError}</div>
              ) : savedPlaces.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Save places you want to revisit and they will appear here.</div>
              ) : (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {savedPlaces.map(({ place }) => (
                    <div key={place.id} className="relative">
                      <PlaceCard {...place} />
                      <button type="button" onClick={() => removeSaved(place.id)} className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-red-600 shadow dark:bg-slate-900/90">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <button
              onClick={handleLogout}
              type="button"
              className="
                mt-8 flex w-full
                items-center justify-center gap-2
                rounded-xl
                border border-red-200
                px-5 py-3
                text-sm font-bold
                text-red-600
                transition-all
                hover:bg-red-50
                dark:border-red-900/60
                dark:text-red-400
                dark:hover:bg-red-950/30
              "
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

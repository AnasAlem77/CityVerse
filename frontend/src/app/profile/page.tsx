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

type UserData = {
  id: string;
  email: string;
  name: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("cityverse_user");

    if (!storedUser) {
      router.push("/login");
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
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

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-slate-500">
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <ArrowLeft size={17} />
          Back to home
        </Link>


        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="h-32 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-700" />


          <div className="px-6 pb-7 sm:px-8">

            <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-slate-100 text-3xl font-bold text-blue-600 shadow-lg dark:border-slate-900 dark:bg-slate-800">
              {user.name.charAt(0).toUpperCase()}
            </div>


            <div className="mt-5">

              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
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

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Email
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Account
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      Active member
                    </p>
                  </div>

                </div>

              </div>

            </div>


            <div className="mt-8 grid gap-4 sm:grid-cols-2">

              <Link
                href="/places"
                className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
              >

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Compass size={20} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    Explore Places
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Discover new destinations
                  </p>
                </div>

              </Link>


              <button
                type="button"
                className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 text-left transition hover:border-pink-300 hover:bg-pink-50 dark:border-slate-700 dark:hover:border-pink-900 dark:hover:bg-pink-950/20"
              >

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400">
                  <Heart size={20} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    Saved Places
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Your favorite destinations
                  </p>
                </div>

              </button>

            </div>


            <button
              onClick={handleLogout}
              type="button"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
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

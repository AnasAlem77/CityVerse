"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const data = await loginUser(
        email,
        password,
      );

      localStorage.setItem(
        "cityverse_token",
        data.access_token,
      );

      localStorage.setItem(
        "cityverse_user",
        JSON.stringify(data.user),
      );

      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 dark:bg-slate-950">

      <div className="w-full max-w-md">

        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Compass size={23} />
          </div>

          <span className="text-xl font-bold text-slate-900 dark:text-white">
            City<span className="text-blue-600">Verse</span>
          </span>
        </Link>


        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Login to continue exploring CityVerse.
          </p>


          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-5"
          >

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>

              <input
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                type="email"
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>


            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>

              <input
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                type="password"
                placeholder="••••••••"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>


            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}


            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              )}

              {loading ? "Logging in..." : "Login"}
            </button>

          </form>


          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{" "}

            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Create one
            </Link>
          </p>

        </div>

      </div>

    </main>
  );
}

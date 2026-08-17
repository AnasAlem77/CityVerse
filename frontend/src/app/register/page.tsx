"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  Compass,
  Loader2,
  Mail,
  Lock,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        name,
        email,
        password,
      });

      setSuccess("Account created successfully.");

      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="
        flex min-h-screen
        items-center justify-center
        bg-slate-50
        px-5 py-12
        transition-colors
        dark:bg-slate-950
      "
    >
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-3"
        >
          <div
            className="
              flex h-11 w-11
              items-center justify-center
              rounded-xl
              bg-blue-600
              text-white
              shadow-md
              shadow-blue-600/20
            "
          >
            <Compass size={23} />
          </div>

          <span className="text-xl font-black text-slate-900 dark:text-white">
            City
            <span className="text-blue-600 dark:text-blue-400">
              Verse
            </span>
          </span>
        </Link>

        <div
          className="
            mt-8 rounded-3xl
            border border-slate-200
            bg-white p-7
            shadow-sm
            dark:border-slate-800
            dark:bg-slate-900
          "
        >
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Join CityVerse and start exploring.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-5"
          >
            <div>
              <label
                htmlFor="name"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Name
              </label>

              <div className="relative mt-2">
                <User
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="name"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  type="text"
                  placeholder="Your name"
                  className="
                    w-full rounded-xl
                    border border-slate-200
                    bg-slate-50
                    py-3 pl-11 pr-4
                    text-sm text-slate-900
                    outline-none
                    transition
                    focus:border-blue-500
                    focus:bg-white
                    focus:ring-4
                    focus:ring-blue-500/10
                    dark:border-slate-700
                    dark:bg-slate-800
                    dark:text-white
                  "
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Email
              </label>

              <div className="relative mt-2">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="register-email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  type="email"
                  placeholder="you@example.com"
                  className="
                    w-full rounded-xl
                    border border-slate-200
                    bg-slate-50
                    py-3 pl-11 pr-4
                    text-sm text-slate-900
                    outline-none
                    transition
                    focus:border-blue-500
                    focus:bg-white
                    focus:ring-4
                    focus:ring-blue-500/10
                    dark:border-slate-700
                    dark:bg-slate-800
                    dark:text-white
                  "
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Password
              </label>

              <div className="relative mt-2">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="register-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  type="password"
                  placeholder="••••••••"
                  className="
                    w-full rounded-xl
                    border border-slate-200
                    bg-slate-50
                    py-3 pl-11 pr-4
                    text-sm text-slate-900
                    outline-none
                    transition
                    focus:border-blue-500
                    focus:bg-white
                    focus:ring-4
                    focus:ring-blue-500/10
                    dark:border-slate-700
                    dark:bg-slate-800
                    dark:text-white
                  "
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                flex w-full
                items-center justify-center gap-2
                rounded-xl
                bg-blue-600
                px-5 py-3
                font-bold text-white
                shadow-sm
                transition-all
                hover:-translate-y-0.5
                hover:bg-blue-700
                hover:shadow-md
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {loading && (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              )}

              {loading
                ? "Creating account..."
                : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

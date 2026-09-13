"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Compass, Loader2, Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const data = await loginUser(email, password);

      signIn(data.access_token, data.user);

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
    <main
      className="
        flex min-h-screen
        items-center justify-center
        bg-[var(--background)]
        px-5 py-12
        transition-colors
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
              bg-[var(--primary)]
              text-white
              shadow-md
              shadow-[var(--primary)]/20
            "
          >
            <Compass size={23} />
          </div>

          <span
            className="
              text-xl font-black
              text-[var(--foreground)]
            "
          >
            City
            <span className="text-[var(--primary)]">
              Verse
            </span>
          </span>
        </Link>

        <div
          className="
            mt-8 rounded-3xl
            border border-[var(--border)]
            bg-[var(--card)] p-5 sm:p-7
            shadow-sm
          "
        >
          <h1 className="text-2xl font-black text-[var(--foreground)]">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Login to continue exploring CityVerse.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Email
              </label>

              <div className="relative mt-2">
                <Mail
                  size={18}
                  className="
                    absolute left-4 top-1/2
                    -translate-y-1/2
                    text-[var(--muted)]
                  "
                />

                <input
                  id="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  type="email"
                  placeholder="you@example.com"
                  className="
                    w-full rounded-xl
                    border border-[var(--border)]
                    bg-[var(--background)]
                    py-3 pl-11 pr-4
                    text-sm text-[var(--foreground)]
                    outline-none
                    transition
                    focus:border-[var(--primary)]
                    focus:bg-[var(--card)]
                    focus:ring-4
                    focus:ring-[var(--primary)]/10
                  "
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Password
              </label>

              <div className="relative mt-2">
                <Lock
                  size={18}
                  className="
                    absolute left-4 top-1/2
                    -translate-y-1/2
                    text-[var(--muted)]
                  "
                />

                <input
                  id="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  type="password"
                  placeholder="••••••••"
                  className="
                    w-full rounded-xl
                    border border-[var(--border)]
                    bg-[var(--background)]
                    py-3 pl-11 pr-4
                    text-sm text-[var(--foreground)]
                    outline-none
                    transition
                    focus:border-[var(--primary)]
                    focus:bg-[var(--card)]
                    focus:ring-4
                    focus:ring-[var(--primary)]/10
                  "
                />
              </div>
            </div>

            {error && (
              <div
                className="
                  rounded-xl
                  border border-red-200
                  bg-red-50
                  px-4 py-3
                  text-sm text-red-600
                  dark:border-red-900/50
                  dark:bg-red-950/30
                  dark:text-red-400
                "
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                flex w-full
                items-center justify-center gap-2
                rounded-xl
                bg-[var(--primary)]
                px-5 py-3
                font-bold text-white
                shadow-sm
                transition-all
                hover:-translate-y-0.5
                hover:bg-[var(--primary-hover)]
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

              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

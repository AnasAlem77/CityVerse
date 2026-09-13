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
import { updateProfile } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

export default function ProfilePage() {
  const router = useRouter();

  const { user, ready, signOut, updateUser } = useAuth();
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [profileError, setProfileError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    getSavedPlaces()
      .then(setSavedPlaces)
      .catch((error) => setSavedError(error instanceof Error ? error.message : "Unable to load saved places."))
      .finally(() => setSavedLoading(false));
  }, [ready, router, user]);

  function handleLogout() {
    signOut();
    router.push("/");
    router.refresh();
  }

  function cancelEdit() { setName(user?.name ?? ""); setProfileError(""); setEditing(false); }
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); if (saving) return; setProfileError(""); setSaving(true);
    try { updateUser(await updateProfile({ name })); setEditing(false); }
    catch (error) { setProfileError(error instanceof Error ? error.message : "Unable to save profile."); }
    finally { setSaving(false); }
  }

  async function removeSaved(placeId: string) {
    try {
      await removeSavedPlace(placeId);
      setSavedPlaces((current) => current.filter((item) => item.place.id !== placeId));
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Unable to remove saved place.");
    }
  }

  if (!ready || !user) {
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
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/"
          className="
            inline-flex items-center gap-2
            text-sm font-semibold
            text-[var(--muted)]
            transition-colors
            hover:text-[var(--primary)]
          "
        >
          <ArrowLeft size={17} />
          Back to home
        </Link>

        <section
          className="
            mt-8 overflow-hidden
            rounded-3xl
            border border-[var(--border)]
            bg-[var(--card)]
            shadow-sm
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
                dark:border-[var(--card)]
                dark:bg-[var(--surface)]
                dark:text-[var(--primary)]
              "
            >
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div className="mt-5">
              {editing ? <form onSubmit={saveProfile} className="max-w-md"><label className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]" htmlFor="profile-name">Name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 font-semibold text-[var(--foreground)]" />{profileError && <p className="mt-2 text-sm text-red-600">{profileError}</p>}<div className="mt-3 flex flex-wrap gap-2"><button disabled={saving} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button><button type="button" onClick={cancelEdit} disabled={saving} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold">Cancel</button></div></form> : <><h1 className="text-3xl font-black text-[var(--foreground)]">{user.name}</h1><button type="button" onClick={() => { setName(user.name); setProfileError(""); setEditing(true); }} className="mt-3 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--primary)]">Edit profile</button></>}

              <p className="mt-1 text-sm text-[var(--muted)]">
                CityVerse Explorer
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--surface-soft)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                    <Mail size={19} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      Email
                    </p>

                    <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--surface-soft)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
                    <User size={19} />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      Account
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
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
                  border border-[var(--border)]
                  p-5
                  transition-all
                  hover:-translate-y-0.5
                  hover:border-[var(--primary)]
                  hover:bg-[var(--primary)]/5
                "
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                  <Compass size={20} />
                </div>

                <div>
                  <h2 className="font-bold text-[var(--foreground)]">
                    Explore Places
                  </h2>

                  <p className="mt-1 text-sm text-[var(--muted)]">
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
                  border border-[var(--border)]
                  p-5 text-left
                  transition-all
                  hover:-translate-y-0.5
                  hover:border-pink-300
                  hover:bg-pink-50
                  dark:hover:border-pink-900
                  dark:hover:bg-pink-950/20
                "
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400">
                  <Heart size={20} />
                </div>

                <div>
                  <h2 className="font-bold text-[var(--foreground)]">
                    Saved Places
                  </h2>

                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Your favorite destinations
                  </p>
                </div>
              </button>
            </div>

            <section id="saved-places" className="mt-10 border-t border-[var(--border)] pt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Your collection</p>
                  <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">Saved Places</h2>
                </div>
                {!savedLoading && <span className="text-sm text-[var(--muted)]">{savedPlaces.length} saved</span>}
              </div>

              {savedLoading ? (
                <p className="mt-5 text-sm text-[var(--muted)]">Loading saved places...</p>
              ) : savedError ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">{savedError}</div>
              ) : savedPlaces.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-sm text-[var(--muted)]">Save places you want to revisit and they will appear here.</div>
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

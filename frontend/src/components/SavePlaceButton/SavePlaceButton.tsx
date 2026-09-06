"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { getSavedPlaces, removeSavedPlace, savePlace } from "@/lib/api";
import Link from "next/link";

export default function SavePlaceButton({ placeId }: { placeId: string }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("cityverse_token");
    setLoggedIn(Boolean(token));
    if (token) getSavedPlaces().then((items) => setSaved(items.some((item) => item.place.id === placeId))).catch(() => undefined);
  }, [placeId]);

  async function toggle() {
    if (!loggedIn) {
      setMessage("Please log in to save places.");
      return;
    }
    try {
      setBusy(true);
      setMessage("");
      if (saved) await removeSavedPlace(placeId);
      else await savePlace(placeId);
      setSaved(!saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update saved place.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 text-right"><button type="button" disabled={busy} onClick={toggle} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] disabled:opacity-50"><Heart className={saved ? "fill-current text-[var(--primary)]" : "text-[var(--primary)]"} size={16} />{saved ? "Saved" : "Save place"}</button>{message && <p className="mt-2 text-xs text-[var(--muted)]">{message} {!loggedIn && <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">Log in</Link>}</p>}</div>;
}

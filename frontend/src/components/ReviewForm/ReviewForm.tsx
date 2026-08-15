"use client";

import { FormEvent, useState } from "react";
import { Send, Star } from "lucide-react";
import { createReview } from "@/lib/api";

type ReviewFormProps = {
  placeId: string;
  onReviewCreated: () => void;
};

export default function ReviewForm({
  placeId,
  onReviewCreated,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (rating < 1 || rating > 5) {
      setError("Please select a rating.");
      return;
    }

    if (!comment.trim()) {
      setError("Please write a review.");
      return;
    }

    const token = localStorage.getItem(
      "cityverse_token",
    );

    if (!token) {
      setError("Please login before writing a review.");
      return;
    }

    try {
      setLoading(true);

      await createReview({
        rating,
        comment: comment.trim(),
        placeId,
      });

      setRating(0);
      setComment("");

      setSuccess("Your review was added successfully.");

      onReviewCreated();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to submit review.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >

      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          Write a review
        </h3>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Share your experience with other CityVerse users.
        </p>
      </div>


      <div className="mt-6">

        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Your rating
        </p>

        <div className="flex gap-2">

          {Array.from({ length: 5 }).map((_, index) => {
            const value = index + 1;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`Rate ${value} stars`}
                className="transition hover:scale-110"
              >
                <Star
                  size={28}
                  className={
                    value <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300 dark:text-slate-700"
                  }
                />
              </button>
            );
          })}

        </div>

      </div>


      <div className="mt-6">

        <label
          htmlFor="review-comment"
          className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          Your review
        </label>

        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) =>
            setComment(event.target.value)
          }
          placeholder="Tell people what you think about this place..."
          rows={5}
          maxLength={1000}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />

        <p className="mt-2 text-right text-xs text-slate-400">
          {comment.length}/1000
        </p>

      </div>


      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}


      {success && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          {success}
        </div>
      )}


      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >

        <Send size={17} />

        {loading
          ? "Submitting..."
          : "Submit Review"}

      </button>

    </form>
  );
}

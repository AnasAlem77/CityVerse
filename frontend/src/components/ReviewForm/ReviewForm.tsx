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

    const token = localStorage.getItem("cityverse_token");

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
    <form onSubmit={handleSubmit} className="space-y-7">

      {/* Rating */}
      <div>
        <div className="mb-3">
          <p className="text-sm font-bold text-[var(--foreground)]">
            Your rating
          </p>

          <p className="mt-1 text-xs text-[var(--muted)]">
            How would you rate this place?
          </p>
        </div>

        <div className="flex items-center gap-1.5">

          {Array.from({ length: 5 }).map((_, index) => {
            const value = index + 1;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`Rate ${value} stars`}
                className="
                  rounded-xl
                  p-2
                  transition-all
                  duration-200
                  hover:scale-110
                  hover:bg-[var(--accent-soft)]
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[var(--accent)]/30
                "
              >
                <Star
                  size={27}
                  className={
                    value <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-[var(--border-strong)]"
                  }
                />
              </button>
            );
          })}

          {rating > 0 && (
            <span className="ml-3 text-sm font-bold text-[var(--muted)]">
              {rating}/5
            </span>
          )}

        </div>
      </div>


      {/* Comment */}
      <div>

        <label
          htmlFor="review-comment"
          className="mb-3 block text-sm font-bold text-[var(--foreground)]"
        >
          Your review
        </label>

        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) =>
            setComment(event.target.value)
          }
          placeholder="Tell other travelers about your experience..."
          rows={6}
          maxLength={1000}
          className="
            w-full
            resize-none
            rounded-2xl
            border
            border-[var(--border)]
            bg-[var(--surface-soft)]
            px-4
            py-4
            text-sm
            text-[var(--foreground)]
            outline-none
            transition-all
            duration-200
            placeholder:text-[var(--muted)]
            focus:border-[var(--accent)]
            focus:bg-[var(--surface)]
            focus:ring-4
            focus:ring-[var(--accent)]/10
          "
        />

        <div className="mt-2 flex justify-end">
          <span className="text-xs font-medium text-[var(--muted)]">
            {comment.length}/1000
          </span>
        </div>

      </div>


      {/* Error */}
      {error && (
        <div
          className="
            rounded-2xl
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            font-medium
            text-red-600
            dark:border-red-900/40
            dark:bg-red-950/20
            dark:text-red-400
          "
        >
          {error}
        </div>
      )}


      {/* Success */}
      {success && (
        <div
          className="
            rounded-2xl
            border
            border-emerald-200
            bg-emerald-50
            px-4
            py-3
            text-sm
            font-medium
            text-emerald-600
            dark:border-emerald-900/40
            dark:bg-emerald-950/20
            dark:text-emerald-400
          "
        >
          {success}
        </div>
      )}


      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="
          group
          inline-flex
          w-full
          items-center
          justify-center
          gap-2
          rounded-2xl
          bg-[var(--primary)]
          px-5
          py-3.5
          text-sm
          font-bold
          text-white
          shadow-lg
          shadow-[var(--primary)]/20
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:shadow-xl
          hover:shadow-[var(--primary)]/25
          disabled:cursor-not-allowed
          disabled:opacity-60
          disabled:hover:translate-y-0
        "
      >
        <Send
          size={17}
          className="transition-transform duration-300 group-hover:translate-x-0.5"
        />

        {loading ? "Submitting..." : "Submit Review"}
      </button>

    </form>
  );
}

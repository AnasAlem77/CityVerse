"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import ReviewForm from "@/components/ReviewForm/ReviewForm";

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user?: {
    id?: string;
    name: string;
  };
};

type PlaceReviewsProps = {
  placeId: string;
  initialReviews: Review[];
};

function formatReviewDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function PlaceReviews({
  placeId,
  initialReviews,
}: PlaceReviewsProps) {
  const [reviews, setReviews] =
    useState<Review[]>(initialReviews);

  const [loading, setLoading] = useState(false);

  async function refreshReviews() {
    try {
      setLoading(true);

      const response = await fetch(
        `http://localhost:3001/reviews/${placeId}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to refresh reviews");
      }

      const data = await response.json();

      setReviews(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>

      <div className="mb-6">

        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Community
        </p>

        <h2 className="mt-1 text-3xl font-bold">
          What visitors say
        </h2>

        {loading && (
          <p className="mt-2 text-sm text-slate-400">
            Updating reviews...
          </p>
        )}

      </div>


      <div className="space-y-4">

        {reviews.length > 0 ? (

          reviews.map((review) => (

            <article
              key={review.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="font-semibold">
                    {review.user?.name ??
                      "CityVerse User"}
                  </p>

                  <div className="mt-2 flex items-center gap-1">

                    {Array.from({
                      length: 5,
                    }).map((_, index) => (

                      <Star
                        key={index}
                        size={15}
                        className={
                          index < review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 dark:text-slate-700"
                        }
                      />

                    ))}

                  </div>

                </div>


                <time className="text-xs text-slate-400">
                  {formatReviewDate(review.createdAt)}
                </time>

              </div>


              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
                {review.comment}
              </p>

            </article>

          ))

        ) : (

          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">

            <p className="font-medium">
              No reviews yet.
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Be the first person to review this place.
            </p>

          </div>

        )}

      </div>


      <section className="mt-12">

        <div className="mb-6">

          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Share your experience
          </p>

          <h2 className="mt-1 text-3xl font-bold">
            Write a review
          </h2>

        </div>


        <ReviewForm
          placeId={placeId}
          onReviewCreated={refreshReviews}
        />

      </section>

    </div>
  );
}

"use client";

import { Star } from "lucide-react";

type RatingProps = {
  value: number;
};

export default function Rating({ value }: RatingProps) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));

  return (
    <div className="mt-4 flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(rating);

        return (
          <Star
            key={index}
            size={17}
            strokeWidth={1.8}
            className={
              filled
                ? "fill-orange-400 text-orange-400"
                : "text-[var(--muted)]/30"
            }
          />
        );
      })}

      <span className="ml-2 text-sm font-semibold text-[var(--muted)]">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

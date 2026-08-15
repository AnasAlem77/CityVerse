import { Star } from "lucide-react";

type ReviewCardProps = {
  rating: number;
  comment: string;
  userName: string;
};

export default function ReviewCard({
  rating,
  comment,
  userName,
}: ReviewCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">

      <div className="flex items-start justify-between gap-4">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div>

            <h3 className="font-semibold text-slate-900 dark:text-white">
              {userName}
            </h3>

            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  size={15}
                  className={
                    index < rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300 dark:text-slate-700"
                  }
                />
              ))}
            </div>

          </div>

        </div>

      </div>


      <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
        {comment}
      </p>

    </article>
  );
}

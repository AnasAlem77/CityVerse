import Link from "next/link";
import Rating from "../Rating/Rating";

type PlaceCardProps = {
  id: string;
  name: string;
  description: string;
  category: string;
  averageRating?: number;
};

export default function PlaceCard({
  id,
  name,
  description,
  category,
  averageRating = 0,
}: PlaceCardProps) {

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg">


      <div className="flex h-44 items-center justify-center bg-gray-100 text-6xl">
        📍
      </div>


      <div className="p-6">

        <p className="text-sm font-medium text-blue-600">
          {category}
        </p>


        <h3 className="mt-2 text-xl font-bold">
          {name}
        </h3>


        <p className="mt-3 text-gray-600">
          {description}
        </p>


        <Rating value={averageRating}/>


        <Link
          href={`/places/${id}`}
          className="mt-4 inline-block font-semibold text-blue-600"
        >
          View Details →
        </Link>

      </div>

    </div>
  );
}

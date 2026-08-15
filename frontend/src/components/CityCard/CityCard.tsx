import Link from "next/link";

type CityCardProps = {
  id: string;
  name: string;
  country: string;
  description?: string;
};

export default function CityCard({
  id,
  name,
  country,
  description,
}: CityCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">

      <div className="flex h-48 items-center justify-center bg-gray-100 text-6xl">
        🌍
      </div>


      <div className="p-6">

        <p className="text-sm font-medium text-blue-600">
          {country}
        </p>


        <h3 className="mt-2 text-2xl font-bold">
          {name}
        </h3>


        <p className="mt-3 text-gray-600">
          {description ??
            "Discover amazing places and experiences in this city."
          }
        </p>


        <Link
          href={`/cities/${id}`}
          className="mt-5 inline-block font-semibold text-blue-600 hover:text-blue-700"
        >
          Explore {name} →
        </Link>

      </div>

    </div>
  );
}

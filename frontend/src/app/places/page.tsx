import PlaceCard from "@/components/PlaceCard/PlaceCard";
import { getPlaces } from "@/lib/api";


export default async function PlacesPage() {

  const places = await getPlaces();


  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">

      <div className="mx-auto max-w-7xl">


        <div className="mb-10">

          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Explore
          </p>


          <h1 className="mt-2 text-4xl font-bold text-gray-900">
            Popular Places
          </h1>


          <p className="mt-3 text-gray-600">
            Discover amazing places around the world.
          </p>

        </div>



        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">


          {places.map((place: any) => (

            <PlaceCard
              key={place.id}
              id={place.id}
              name={place.name}
              description={place.description}
              category={place.category}
              averageRating={place.averageRating}
            />

          ))}


        </div>


      </div>


    </main>
  );
}

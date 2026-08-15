import { getCities } from "@/lib/api";
import CityCard from "@/components/CityCard/CityCard";


export default async function CitiesPage() {

  const cities = await getCities();


  return (

    <section className="mx-auto max-w-7xl px-6 py-12">


      <div className="mb-10">

        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          Explore
        </p>


        <h1 className="mt-2 text-4xl font-bold">
          Cities
        </h1>


        <p className="mt-3 text-gray-600">
          Discover amazing cities around the world.
        </p>

      </div>



      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">


        {
          cities.map((city:any)=>(
            
            <CityCard
              key={city.id}
              id={city.id}
              name={city.name}
              country={city.country}
            />

          ))
        }


      </div>


    </section>

  );
}

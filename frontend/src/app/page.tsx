import Hero from "@/components/Hero/Hero";
import { getFeaturedCities } from "@/lib/api";


export default async function Home(){

  const cities = await getFeaturedCities();

  return (
    <main>
      <Hero cities={cities}/>
    </main>
  );

}

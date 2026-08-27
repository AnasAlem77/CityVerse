import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});


async function main() {

  await prisma.city.deleteMany();


  await prisma.city.createMany({
    data: [

      {
        name: "Bali",
        country: "Indonesia",
        description:
          "A tropical paradise famous for beaches, temples, nature, and unforgettable experiences.",
        image: "/images/bali.jpg",
        featured: true,
        featuredOrder: 1,
        latitude: -8.3405,
        longitude: 115.0920,
      },


      {
        name: "Jakarta",
        country: "Indonesia",
        description:
          "The capital city of Indonesia, known for modern life, culture, shopping, and history.",
        image: "/images/jakarta.jpg",
        featured: true,
        featuredOrder: 2,
        latitude: -6.2088,
        longitude: 106.8456,
      },


      {
        name: "Dubai",
        country: "United Arab Emirates",
        description:
          "A modern global city famous for luxury, architecture, shopping, and futuristic experiences.",
        image: "/images/dubai.jpg",
        featured: true,
        featuredOrder: 3,
        latitude: 25.2048,
        longitude: 55.2708,
      },


      {
        name: "Paris",
        country: "France",
        description:
          "The city of light, famous for art, culture, history, cafés, and iconic landmarks.",
        image: "/images/paris.jpg",
        featured: true,
        featuredOrder: 4,
        latitude: 48.8566,
        longitude: 2.3522,
      },


      {
        name: "Tokyo",
        country: "Japan",
        description:
          "A vibrant city combining modern technology, tradition, food, and unforgettable experiences.",
        image: "/images/tokyo.jpg",
        featured: true,
        featuredOrder: 5,
        latitude: 35.6762,
        longitude: 139.6503,
      },

    ],
  });


  console.log("Cities seeded successfully");
}


main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

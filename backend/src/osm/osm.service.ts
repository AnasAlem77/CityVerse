import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type OsmPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
    'addr:street'?: string;
    'addr:city'?: string;
  };
};

type OverpassResponse = {
  elements: OverpassElement[];
};

@Injectable()
export class OsmService {
  private readonly overpassUrls = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius = 5000,
  ): Promise<OsmPlace[]> {
    const query = `
      [out:json][timeout:30];

      (
        node(around:${radius},${latitude},${longitude})["amenity"="hospital"];
        way(around:${radius},${latitude},${longitude})["amenity"="hospital"];

        node(around:${radius},${latitude},${longitude})["amenity"="university"];
        way(around:${radius},${latitude},${longitude})["amenity"="university"];

        node(around:${radius},${latitude},${longitude})["amenity"="restaurant"];
        way(around:${radius},${latitude},${longitude})["amenity"="restaurant"];

        node(around:${radius},${latitude},${longitude})["tourism"="hotel"];
        way(around:${radius},${latitude},${longitude})["tourism"="hotel"];

        node(around:${radius},${latitude},${longitude})["tourism"="attraction"];
        way(around:${radius},${latitude},${longitude})["tourism"="attraction"];

        node(around:${radius},${latitude},${longitude})["shop"];
        way(around:${radius},${latitude},${longitude})["shop"];
      );

      out center tags;
    `;

    console.log('========== OSM REQUEST ==========');
    console.log('Latitude:', latitude);
    console.log('Longitude:', longitude);
    console.log('Radius:', radius);
    console.log('=================================');

    let data: OverpassResponse | null = null;

    for (const overpassUrl of this.overpassUrls) {
      try {
        console.log(
          `Trying Overpass server: ${overpassUrl}`,
        );

        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, 40000);

        const response = await fetch(overpassUrl, {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'CityVerse/1.0',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();

          console.error(
            '========== OVERPASS ERROR ==========',
          );

          console.error(
            'Server:',
            overpassUrl,
          );

          console.error(
            'Status:',
            response.status,
          );

          console.error(
            'Status Text:',
            response.statusText,
          );

          console.error(
            'Response:',
            errorText.slice(0, 500),
          );

          console.error(
            '====================================',
          );

          continue;
        }

        data =
          (await response.json()) as OverpassResponse;

        console.log(
          `Overpass success: ${overpassUrl}`,
        );

        break;
      } catch (error) {
        console.error(
          `Overpass server failed: ${overpassUrl}`,
        );

        console.error(error);
      }
    }

    if (!data) {
      throw new Error(
        'All Overpass servers failed',
      );
    }

    console.log(
      `Overpass returned ${data.elements.length} elements`,
    );

    return data.elements
      .filter((element) => {
        return Boolean(element.tags?.name);
      })
      .map((element) => {
        const latitudeValue =
          element.lat ??
          element.center?.lat;

        const longitudeValue =
          element.lon ??
          element.center?.lon;

        return {
          id:
            `osm-${element.type}-${element.id}`,

          name:
            element.tags?.name ??
            'Unknown place',

          category:
            this.getCategory(element),

          latitude:
            latitudeValue ?? 0,

          longitude:
            longitudeValue ?? 0,

          address:
            this.getAddress(element),

          city:
            element.tags?.['addr:city'],
        };
      })
      .filter((place) => {
        return (
          place.latitude !== 0 &&
          place.longitude !== 0
        );
      });
  }

  async importNearbyPlaces(
    cityId: string,
    latitude: number,
    longitude: number,
    radius = 5000,
  ) {
    console.log('========== OSM IMPORT ==========');
    console.log('City ID:', cityId);
    console.log('Latitude:', latitude);
    console.log('Longitude:', longitude);
    console.log('Radius:', radius);
    console.log('================================');

    const city =
      await this.prisma.city.findUnique({
        where: {
          id: cityId,
        },
      });

    if (!city) {
      throw new Error(
        `City not found: ${cityId}`,
      );
    }

    const osmPlaces =
      await this.searchNearbyPlaces(
        latitude,
        longitude,
        radius,
      );

    let imported = 0;
    let skipped = 0;

    for (const place of osmPlaces) {
      const existing =
        await this.prisma.place.findUnique({
          where: {
            osmId: place.id,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.place.create({
        data: {
          osmId: place.id,
          name: place.name,
          description:
            'Imported from OpenStreetMap',
          category: place.category,
          latitude: place.latitude,
          longitude: place.longitude,
          cityId: city.id,
        },
      });

      imported++;
    }

    console.log(
      '========== OSM IMPORT RESULT =========',
    );

    console.log(
      'City:',
      city.name,
    );

    console.log(
      'Found:',
      osmPlaces.length,
    );

    console.log(
      'Imported:',
      imported,
    );

    console.log(
      'Skipped:',
      skipped,
    );

    console.log(
      '=======================================',
    );

    return {
      city: {
        id: city.id,
        name: city.name,
        country: city.country,
      },
      radius,
      found: osmPlaces.length,
      imported,
      skipped,
    };
  }

  private getCategory(
    element: OverpassElement,
  ): string {
    if (
      element.tags?.amenity === 'hospital'
    ) {
      return 'hospital';
    }

    if (
      element.tags?.amenity === 'university'
    ) {
      return 'university';
    }

    if (
      element.tags?.amenity === 'restaurant'
    ) {
      return 'restaurant';
    }

    if (
      element.tags?.tourism === 'hotel'
    ) {
      return 'hotel';
    }

    if (
      element.tags?.tourism === 'attraction'
    ) {
      return 'attraction';
    }

    if (element.tags?.shop) {
      return 'shop';
    }

    return 'place';
  }

  private getAddress(
    element: OverpassElement,
  ): string | undefined {
    const street =
      element.tags?.['addr:street'];

    const city =
      element.tags?.['addr:city'];

    if (street && city) {
      return `${street}, ${city}`;
    }

    if (street) {
      return street;
    }

    if (city) {
      return city;
    }

    return undefined;
  }
}

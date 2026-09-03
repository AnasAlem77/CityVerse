import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export interface OsmPlace {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  cuisine?: string;
  wheelchair?: string;
  internetAccess?: string;
}

@Injectable()
export class OsmService {
  private readonly logger = new Logger(OsmService.name);

  private readonly overpassUrls = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  private readonly updateBatchSize = 100;

  private readonly retryBatchSizes = [
    100,
    50,
    25,
    10,
    1,
  ];

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================
  // SEARCH NEARBY PLACES
  // ============================================================

  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius = 5000,
    category?: string,
  ): Promise<OsmPlace[]> {
    const categories = category
      ? [category]
      : [
          'hospital',
          'university',
          'restaurant',
          'hotel',
          'attraction',
          'shop',
        ];

    const categoryQueries = categories
      .map((item) => this.buildCategoryFilter(item))
      .filter(Boolean);

    const query = `
      [out:json][timeout:60];
      (
        ${categoryQueries.join('\n')}
      );
      out center tags;
    `;

    const data = await this.fetchOverpass(query);

    return data.elements
      .map((element) => this.mapOsmPlace(element))
      .filter(
        (place): place is OsmPlace =>
          place !== null && place.category !== 'other',
      );
  }

  // ============================================================
  // IMPORT NEARBY PLACES
  // ============================================================

  async importNearbyPlaces(
    cityId: string,
    latitude: number,
    longitude: number,
    radius = 5000,
    category?: string,
  ) {
    const city = await this.prisma.city.findUnique({
      where: {
        id: cityId,
      },
    });

    if (!city) {
      throw new NotFoundException(
        `City with id ${cityId} not found`,
      );
    }

    const osmPlaces =
      await this.searchNearbyPlaces(
        latitude,
        longitude,
        radius,
        category,
      );

    let imported = 0;

    for (const place of osmPlaces) {
      await this.prisma.place.upsert({
        where: {
          osmId: place.id,
        },
        update: {
          name: place.name,
          description: place.description || '',
          category: place.category,
          address: place.address || null,
          website: place.website || null,
          phone: place.phone || null,
          openingHours:
            place.openingHours || null,
          cuisine: place.cuisine || null,
          wheelchair:
            place.wheelchair || null,
          internetAccess:
            place.internetAccess || null,
          latitude: place.latitude,
          longitude: place.longitude,
        },
        create: {
          osmId: place.id,
          name: place.name,
          description: place.description || '',
          category: place.category,
          address: place.address || null,
          website: place.website || null,
          phone: place.phone || null,
          openingHours:
            place.openingHours || null,
          cuisine: place.cuisine || null,
          wheelchair:
            place.wheelchair || null,
          internetAccess:
            place.internetAccess || null,
          latitude: place.latitude,
          longitude: place.longitude,
          cityId,
        },
      });

      imported++;
    }

    return {
      cityId,
      cityName: city.name,
      found: osmPlaces.length,
      imported,
    };
  }

  // ============================================================
  // IMPORT ALL PLACES FOR CITY
  // ============================================================

  async importPlacesForCity(
    cityId: string,
  ) {
    const city = await this.prisma.city.findUnique({
      where: {
        id: cityId,
      },
    });

    if (!city) {
      throw new NotFoundException(
        `City with id ${cityId} not found`,
      );
    }

    const categoryQueries = [
      'hospital',
      'university',
      'restaurant',
      'hotel',
      'attraction',
      'shop',
    ]
      .map((category) =>
        this.buildCategoryFilter(category),
      )
      .filter(Boolean);

    const query = `
      [out:json][timeout:120];
      (
        ${categoryQueries.join('\n')}
      );
      out center tags;
    `;

    const data = await this.fetchOverpass(query);

    const osmPlaces = data.elements
      .map((element) => this.mapOsmPlace(element))
      .filter(
        (place): place is OsmPlace =>
          place !== null &&
          place.category !== 'other',
      );

    let imported = 0;

    for (const place of osmPlaces) {
      await this.prisma.place.upsert({
        where: {
          osmId: place.id,
        },
        update: {
          name: place.name,
          description: place.description || '',
          category: place.category,
          address: place.address || null,
          website: place.website || null,
          phone: place.phone || null,
          openingHours:
            place.openingHours || null,
          cuisine: place.cuisine || null,
          wheelchair:
            place.wheelchair || null,
          internetAccess:
            place.internetAccess || null,
          latitude: place.latitude,
          longitude: place.longitude,
        },
        create: {
          osmId: place.id,
          name: place.name,
          description: place.description || '',
          category: place.category,
          address: place.address || null,
          website: place.website || null,
          phone: place.phone || null,
          openingHours:
            place.openingHours || null,
          cuisine: place.cuisine || null,
          wheelchair:
            place.wheelchair || null,
          internetAccess:
            place.internetAccess || null,
          latitude: place.latitude,
          longitude: place.longitude,
          cityId,
        },
      });

      imported++;
    }

    return {
      cityId,
      cityName: city.name,
      found: osmPlaces.length,
      imported,
    };
  }

  // ============================================================
  // UPDATE EXISTING PLACES FROM OSM
  //
  // IMPORTANT:
  // - Does NOT delete places.
  // - Does NOT create new places.
  // - Uses existing OSM IDs.
  // - If a batch fails, retries it with smaller batches.
  // - Empty OSM optional fields do NOT erase existing DB data.
  // ============================================================

  async updateExistingPlacesFromOsm(
    cityId: string,
  ) {
    const city = await this.prisma.city.findUnique({
      where: {
        id: cityId,
      },
    });

    if (!city) {
      throw new NotFoundException(
        `City with id ${cityId} not found`,
      );
    }

    const existingPlaces =
      await this.prisma.place.findMany({
        where: {
          cityId,
          osmId: {
            not: null,
          },
        },
        select: {
          id: true,
          osmId: true,
          name: true,
          description: true,
          category: true,
          address: true,
          website: true,
          phone: true,
          openingHours: true,
          cuisine: true,
          wheelchair: true,
          internetAccess: true,
          latitude: true,
          longitude: true,
        },
      });

    let matched = 0;
    let updated = 0;
    let notFound = 0;
    let failed = 0;

    const failedBatches: string[][] = [];

    const totalBatches = Math.ceil(
      existingPlaces.length /
        this.updateBatchSize,
    );

    for (
      let start = 0;
      start < existingPlaces.length;
      start += this.updateBatchSize
    ) {
      const batch = existingPlaces.slice(
        start,
        start + this.updateBatchSize,
      );

      const batchNumber =
        Math.floor(
          start / this.updateBatchSize,
        ) + 1;

      this.logger.log(
        `Updating OSM batch ${batchNumber} / ${totalBatches} (${batch.length} places)...`,
      );

      const result =
        await this.updateExistingBatchWithRetry(
          batch,
          batchNumber,
        );

      matched += result.matched;
      updated += result.updated;
      notFound += result.notFound;

      if (result.failedIds.length > 0) {
        failed += result.failedIds.length;
        failedBatches.push(
          result.failedIds,
        );
      }
    }

    return {
      cityId,
      cityName: city.name,
      existingPlaces: existingPlaces.length,
      osmPlacesQueried: existingPlaces.length,
      matched,
      updated,
      notFound,
      failed,
      batchSize: this.updateBatchSize,
      failedBatches: failedBatches.length,
    };
  }

  // ============================================================
  // UPDATE ONE BATCH + RETRY WITH SMALLER BATCHES
  // ============================================================

  private async updateExistingBatchWithRetry(
    batch: Array<{
      id: string;
      osmId: string | null;
      name: string;
      description: string;
      category: string;
      address: string | null;
      website: string | null;
      phone: string | null;
      openingHours: string | null;
      cuisine: string | null;
      wheelchair: string | null;
      internetAccess: string | null;
      latitude: unknown;
      longitude: unknown;
    }>,
    batchNumber: number,
  ): Promise<{
    matched: number;
    updated: number;
    notFound: number;
    failedIds: string[];
  }> {
    if (batch.length === 0) {
      return {
        matched: 0,
        updated: 0,
        notFound: 0,
        failedIds: [],
      };
    }

    try {
      const osmIds = batch
        .map((place) => place.osmId)
        .filter(
          (osmId): osmId is string =>
            Boolean(osmId),
        );

      const query =
        this.buildOsmIdsQuery(osmIds);

      const data =
        await this.fetchOverpass(query);

      const osmPlaces = data.elements
        .map((element) =>
          this.mapOsmPlace(element),
        )
        .filter(
          (place): place is OsmPlace =>
            place !== null,
        );

      const osmMap = new Map<
        string,
        OsmPlace
      >();

      for (const place of osmPlaces) {
        osmMap.set(
          this.normalizeOsmId(place.id),
          place,
        );
      }

      let matched = 0;
      let updated = 0;
      let notFound = 0;

      for (const existing of batch) {
        if (!existing.osmId) {
          continue;
        }

        const normalizedId =
          this.normalizeOsmId(
            existing.osmId,
          );

        const osmPlace =
          osmMap.get(normalizedId);

        if (!osmPlace) {
          notFound++;
          continue;
        }

        matched++;

        const updateData: {
          name: string;
          category: string;
          latitude: number;
          longitude: number;
          description?: string;
          address?: string;
          website?: string;
          phone?: string;
          openingHours?: string;
          cuisine?: string;
          wheelchair?: string;
          internetAccess?: string;
        } = {
          name: osmPlace.name,
          category: osmPlace.category,
          latitude: osmPlace.latitude,
          longitude: osmPlace.longitude,
        };

        // Only update optional fields when
        // OSM actually has a non-empty value.

        if (osmPlace.description?.trim()) {
          updateData.description =
            osmPlace.description.trim();
        }

        if (osmPlace.address?.trim()) {
          updateData.address =
            osmPlace.address.trim();
        }

        if (osmPlace.website?.trim()) {
          updateData.website =
            osmPlace.website.trim();
        }

        if (osmPlace.phone?.trim()) {
          updateData.phone =
            osmPlace.phone.trim();
        }

        if (osmPlace.openingHours?.trim()) {
          updateData.openingHours =
            osmPlace.openingHours.trim();
        }

        if (osmPlace.cuisine?.trim()) {
          updateData.cuisine =
            osmPlace.cuisine.trim();
        }

        if (osmPlace.wheelchair?.trim()) {
          updateData.wheelchair =
            osmPlace.wheelchair.trim();
        }

        if (osmPlace.internetAccess?.trim()) {
          updateData.internetAccess =
            osmPlace.internetAccess.trim();
        }

        await this.prisma.place.update({
          where: {
            id: existing.id,
          },
          data: updateData,
        });

        updated++;
      }

      return {
        matched,
        updated,
        notFound,
        failedIds: [],
      };
    } catch (error) {
      this.logger.warn(
        `Failed OSM batch ${batchNumber} with ${batch.length} places: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      // If the batch is already small,
      // retrying further is not useful.
      if (batch.length <= 1) {
        const failedIds = batch
          .map((place) => place.osmId)
          .filter(
            (osmId): osmId is string =>
              Boolean(osmId),
          );

        return {
          matched: 0,
          updated: 0,
          notFound: 0,
          failedIds,
        };
      }

      // Split the failed batch into two smaller batches.
      const middle = Math.ceil(
        batch.length / 2,
      );

      const firstHalf =
        batch.slice(0, middle);

      const secondHalf =
        batch.slice(middle);

      this.logger.log(
        `Retrying failed batch ${batchNumber} as ${firstHalf.length} + ${secondHalf.length} places...`,
      );

      const firstResult =
        await this.updateExistingBatchWithRetry(
          firstHalf,
          batchNumber,
        );

      const secondResult =
        await this.updateExistingBatchWithRetry(
          secondHalf,
          batchNumber,
        );

      return {
        matched:
          firstResult.matched +
          secondResult.matched,

        updated:
          firstResult.updated +
          secondResult.updated,

        notFound:
          firstResult.notFound +
          secondResult.notFound,

        failedIds: [
          ...firstResult.failedIds,
          ...secondResult.failedIds,
        ],
      };
    }
  }

  // ============================================================
  // BUILD OSM ID QUERY
  // ============================================================

  private buildOsmIdsQuery(
    osmIds: string[],
  ): string {
    const nodes: string[] = [];
    const ways: string[] = [];
    const relations: string[] = [];

    for (const rawId of osmIds) {
      const normalized =
        this.normalizeOsmId(rawId);

      const match =
        normalized.match(
          /^(node|way|relation)\/(\d+)$/,
        );

      if (!match) {
        continue;
      }

      const type = match[1];
      const id = match[2];

      if (type === 'node') {
        nodes.push(id);
      }

      if (type === 'way') {
        ways.push(id);
      }

      if (type === 'relation') {
        relations.push(id);
      }
    }

    const parts: string[] = [];

    if (nodes.length > 0) {
      parts.push(
        `node(id:${nodes.join(',')});`,
      );
    }

    if (ways.length > 0) {
      parts.push(
        `way(id:${ways.join(',')});`,
      );
    }

    if (relations.length > 0) {
      parts.push(
        `relation(id:${relations.join(',')});`,
      );
    }

    return `
      [out:json][timeout:120];
      (
        ${parts.join('\n')}
      );
      out center tags;
    `;
  }

  // ============================================================
  // NORMALIZE OSM ID
  // ============================================================

  private normalizeOsmId(
    osmId: string,
  ): string {
    let value = osmId.trim();

    value = value.replace(
      /^osm-/,
      '',
    );

    value = value.replace(
      /^(node|way|relation)-/,
      '$1/',
    );

    return value;
  }

  // ============================================================
  // MAP OSM PLACE
  // ============================================================

  private mapOsmPlace(
    element: OverpassElement,
  ): OsmPlace | null {
    const tags = element.tags ?? {};

    const name =
      tags.name?.trim();

    if (!name) {
      return null;
    }

    const latitude =
      element.lat ??
      element.center?.lat;

    const longitude =
      element.lon ??
      element.center?.lon;

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      return null;
    }

    const category =
      this.detectCategory(tags);

    const address =
      this.buildAddress(tags);

    return {
      id: `${element.type}/${element.id}`,
      name,
      description:
        tags.description?.trim() ||
        tags.comment?.trim() ||
        '',
      category,
      latitude,
      longitude,
      address,
      website:
        tags.website?.trim() ||
        tags['contact:website']?.trim(),
      phone:
        tags.phone?.trim() ||
        tags['contact:phone']?.trim(),
      openingHours:
        tags.opening_hours?.trim(),
      cuisine:
        tags.cuisine?.trim(),
      wheelchair:
        tags.wheelchair?.trim(),
      internetAccess:
        tags.internet_access?.trim(),
    };
  }

  // ============================================================
  // DETECT CATEGORY
  // ============================================================

  private detectCategory(
    tags: Record<string, string>,
  ): string {
    if (tags.amenity === 'hospital') {
      return 'hospital';
    }

    if (
      tags.amenity === 'university'
    ) {
      return 'university';
    }

    if (
      tags.amenity === 'restaurant'
    ) {
      return 'restaurant';
    }

    if (tags.tourism === 'hotel') {
      return 'hotel';
    }

    if (
      tags.tourism === 'attraction'
    ) {
      return 'attraction';
    }

    if (tags.shop) {
      return 'shop';
    }

    return 'other';
  }

  // ============================================================
  // BUILD ADDRESS
  // ============================================================

  private buildAddress(
    tags: Record<string, string>,
  ): string | undefined {
    const parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:suburb'],
      tags['addr:city'],
    ]
      .map((value) => value?.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return undefined;
    }

    return parts.join(', ');
  }

  // ============================================================
  // CATEGORY FILTER
  // ============================================================

  private buildCategoryFilter(
    category: string,
  ): string {
    switch (category) {
      case 'hospital':
        return `
          nwr(
            around:5000,
            LATITUDE,
            LONGITUDE
          )["amenity"="hospital"];
        `.replace(
          /LATITUDE/g,
          '0',
        )
        .replace(
          /LONGITUDE/g,
          '0',
        );

      case 'university':
        return `
          nwr(
            around:5000,
            LATITUDE,
            LONGITUDE
          )["amenity"="university"];
        `.replace(
          /LATITUDE/g,
          '0',
        )
        .replace(
          /LONGITUDE/g,
          '0',
        );

      case 'restaurant':
        return `
          nwr(
            around:5000,
            LATITUDE,
            LONGITUDE
          )["amenity"="restaurant"];
        `.replace(
          /LATITUDE/g,
          '0',
        )
        .replace(
          /LONGITUDE/g,
          '0',
        );

      case 'hotel':
        return `
          nwr(
            around:5000,
            LATITUDE,
            LONGITUDE
          )["tourism"="hotel"];
        `.replace(
          /LATITUDE/g,
          '0',
        )
        .replace(
          /LONGITUDE/g,
          '0',
        );

      case 'attraction':
        return `
          nwr(
            around:5000,
            LATITUDE,
            LONGITUDE
          )["tourism"="attraction"];
        `.replace(
          /LATITUDE/g,
          '0',
        )
        .replace(
          /LONGITUDE/g,
          '0',
        );

      case 'shop':
        return `
          nwr(
            around:5000,
            LATITUDE,
            LONGITUDE
          )["shop"];
        `.replace(
          /LATITUDE/g,
          '0',
        )
        .replace(
          /LONGITUDE/g,
          '0',
        );

      default:
        return '';
    }
  }

  // ============================================================
  // FETCH OVERPASS
  // ============================================================

  private async fetchOverpass(
    query: string,
  ): Promise<OverpassResponse> {
    let lastError: unknown;

    for (
      let i = 0;
      i < this.overpassUrls.length;
      i++
    ) {
      const url =
        this.overpassUrls[i];

      try {
        this.logger.log(
          `Trying Overpass API: ${url}`,
        );

        const response =
          await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
              'User-Agent':
                'CityVerse/1.0 (smart city digital twin project)',
            },
            body:
              `data=${encodeURIComponent(
                query,
              )}`,
          });

        if (!response.ok) {
          const errorMessage =
            `Overpass returned HTTP ${response.status}`;

          this.logger.warn(
            `${errorMessage} from ${url}`,
          );

          lastError =
            new Error(errorMessage);

          if (response.status === 429) {
            const retryAfter =
              response.headers.get(
                'retry-after',
              );

            const waitSeconds =
              retryAfter
                ? Number(retryAfter)
                : 3;

            const safeWaitSeconds =
              Number.isFinite(
                waitSeconds,
              ) &&
              waitSeconds > 0 &&
              waitSeconds <= 30
                ? waitSeconds
                : 3;

            this.logger.warn(
              `Rate limited. Waiting ${safeWaitSeconds}s before next attempt...`,
            );

            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  safeWaitSeconds *
                    1000,
                ),
            );
          }

          continue;
        }

        return (await response.json()) as OverpassResponse;
      } catch (error) {
        lastError = error;

        this.logger.warn(
          `Overpass request failed: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
        );
      }
    }

    throw new Error(
      `All Overpass APIs failed: ${
        lastError instanceof Error
          ? lastError.message
          : String(lastError)
      }`,
    );
  }
}
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { calculateCityVerseScore } from './cityverse-score';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const SEARCH_ALIASES: Array<[RegExp, string[]]> = [
  [/\bcoffee\s+shop\b|\bcoffee\b|\bcafe\b/, ['cafe', 'coffee']],
  [/\brestaurant\b|\bfood\b|\beat\b/, ['restaurant', 'food']],
  [/\blaundry\b|\bwash\s+clothes\b/, ['laundry']],
  [/\bbeach\b|\bsea\b/, ['beach']],
  [/\bhotel\b|\bstay\b/, ['hotel', 'accommodation']],
  [/\bmosque\b/, ['mosque']],
  [/\bpark\b/, ['park']],
];

function searchTerms(value: string) {
  const normalized = value.toLowerCase().trim();
  const terms = new Set([normalized]);
  for (const [pattern, aliases] of SEARCH_ALIASES) {
    if (pattern.test(normalized)) aliases.forEach((alias) => terms.add(alias));
  }
  return [...terms];
}

function searchScore(place: { name: string; category: string; subtype: string | null; description: string | null; address: string | null; city: { name: string } }, terms: string[]) {
  const name = place.name.toLowerCase();
  const category = place.category.toLowerCase();
  const subtype = place.subtype?.toLowerCase() ?? '';
  const city = place.city.name.toLowerCase();
  const description = place.description?.toLowerCase() ?? '';
  const address = place.address?.toLowerCase() ?? '';
  return Math.max(...terms.map((term) => {
    if (name === term) return 1000;
    if (name.startsWith(term)) return 800;
    if (name.includes(term)) return 600;
    if (category.includes(term)) return 450;
    if (subtype.includes(term)) return 400;
    if (city.includes(term)) return 250;
    if (description.includes(term) || address.includes(term)) return 100;
    return 0;
  }));
}

export type PlacesSort =
  | 'name_asc'
  | 'name_desc'
  | 'newest'
  | 'most_reviewed';

export type GetPlacesOptions = {
  page?: number;
  limit?: number;
  city?: string;
  category?: string;
  subtype?: string;
  search?: string;
  sort?: string;
};

@Injectable()
export class PlacesService {
  private readonly r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  private async signPlaceImages(images: Array<{ url: string; [key: string]: any }>) {
    return Promise.all(
      images.map(async (image) => {
        if (image.source !== 'mapillary' || !image.url) {
          return image;
        }

        const marker = '/places/';
        const markerIndex = image.url.indexOf(marker);

        if (markerIndex === -1) {
          return image;
        }

        const key = image.url.slice(markerIndex + 1);

        const signedUrl = await getSignedUrl(
          this.r2Client,
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: key,
          }),
          { expiresIn: 3600 },
        );

        return {
          ...image,
          url: signedUrl,
        };
      }),
    );
  }

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createPlace(data: CreatePlaceDto) {
    return this.prisma.place.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        subtype: data.subtype,

        latitude: data.latitude,
        longitude: data.longitude,

        cityId: data.cityId,
      },
    });
  }

  async getPlaces(options: GetPlacesOptions = {}) {
    const safePage = Math.max(
      1,
      Math.floor(options.page ?? DEFAULT_PAGE),
    );
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT)),
    );
    const skip = (safePage - 1) * safeLimit;

    const sort: PlacesSort =
      options.sort === 'name_desc' ||
      options.sort === 'newest' ||
      options.sort === 'most_reviewed'
        ? options.sort
        : 'name_asc';

    const search = options.search?.trim();
    const terms = search ? searchTerms(search) : [];
    const where: Prisma.PlaceWhereInput = {};

    if (options.city?.trim()) {
      const city = options.city.trim();
      where.city = {
        OR: [
          { id: city },
          { name: { equals: city, mode: 'insensitive' } },
        ],
      };
    }

    if (options.category?.trim()) {
      where.category = options.category.trim();
    }

    if (options.subtype?.trim()) {
      where.subtype = options.subtype.trim();
    }

    if (search) {
      where.OR = [
        ...terms.flatMap((term) => [
          { name: { contains: term, mode: 'insensitive' as const } },
          { description: { contains: term, mode: 'insensitive' as const } },
          { address: { contains: term, mode: 'insensitive' as const } },
          { category: { contains: term, mode: 'insensitive' as const } },
          { subtype: { contains: term, mode: 'insensitive' as const } },
        ]),
        {
          city: {
            OR: terms.map((term) => ({ name: { contains: term, mode: 'insensitive' as const } })),
          },
        },
      ];
    }

    const orderBy =
      sort === 'name_desc'
        ? [{ name: 'desc' as const }, { id: 'asc' as const }]
        : sort === 'newest'
          ? [{ createdAt: 'desc' as const }, { id: 'asc' as const }]
          : sort === 'most_reviewed'
            ? [
                { reviews: { _count: 'desc' as const } },
                { name: 'asc' as const },
                { id: 'asc' as const },
              ]
            : [{ name: 'asc' as const }, { id: 'asc' as const }];

    const [total, places] = await this.prisma.$transaction([
      this.prisma.place.count({ where }),
      this.prisma.place.findMany({
        where,
        ...(search ? {} : { skip, take: safeLimit }),
        orderBy,
        select: {
          id: true,
          osmId: true,
          name: true,
          description: true,
          category: true,
          subtype: true,
          address: true,
          latitude: true,
          longitude: true,
          cityId: true,
          createdAt: true,
          updatedAt: true,
          images: true,
          city: {
            select: {
              id: true,
              name: true,
              country: true,
            },
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
      }),
    ]);

    const rankedPlaces = search
      ? places
          .map((place) => ({ place, score: searchScore(place, terms) }))
          .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name) || a.place.id.localeCompare(b.place.id))
          .slice(skip, skip + safeLimit)
          .map(({ place }) => place)
      : places;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      data: await Promise.all(
        rankedPlaces.map(async (place) => ({
          ...place,
          images: await this.signPlaceImages(place.images),
          cityVerseScore: Number(calculateCityVerseScore(place).toFixed(1)),
          reviewsCount: place._count.reviews,
          _count: undefined,
        })),
      ),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      filters: {
        city: options.city?.trim() || null,
        category: options.category?.trim() || null,
        subtype: options.subtype?.trim() || null,
        search: search || null,
        sort,
      },
    };
  }

  async getPlaceFilters(city?: string) {
    const where: Prisma.PlaceWhereInput = {};

    if (city?.trim()) {
      const value = city.trim();
      where.city = {
        OR: [
          { id: value },
          { name: { equals: value, mode: 'insensitive' } },
        ],
      };
    }

    const [categories, subtypes] = await Promise.all([
      this.prisma.place.groupBy({
        by: ['category'],
        where,
        orderBy: {
          category: 'asc',
        },
      }),
      this.prisma.place.groupBy({
        by: ['category', 'subtype'],
        where: {
          ...where,
          subtype: { not: null },
        },
        orderBy: [
          { category: 'asc' },
          { subtype: 'asc' },
        ],
      }),
    ]);

    return {
      categories: categories.map((item) => item.category),
      subtypes: subtypes
        .filter(
          (item): item is typeof item & { subtype: string } =>
            item.subtype !== null,
        )
        .map((item) => ({
          category: item.category,
          value: item.subtype,
        })),
    };
  }

  async getPlaceById(id: string) {
    const place = await this.prisma.place.findUnique({
      where: {
        id,
      },

      include: {
        city: true,

        images: true,

        reviews: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!place) {
      return null;
    }

    const reviewsCount = place.reviews.length;

    const averageRating =
      reviewsCount === 0
        ? 0
        : place.reviews.reduce(
            (sum, review) => sum + review.rating,
            0,
          ) / reviewsCount;

    return {
      id: place.id,
      osmId: place.osmId,

      name: place.name,
      description: place.description,
      category: place.category,
      subtype: place.subtype,

      address: place.address,
      website: place.website,
      phone: place.phone,
      openingHours: place.openingHours,
      cuisine: place.cuisine,
      wheelchair: place.wheelchair,
      internetAccess: place.internetAccess,

      latitude: place.latitude,
      longitude: place.longitude,

      cityId: place.cityId,

      createdAt: place.createdAt,
      updatedAt: place.updatedAt,

      city: place.city,
      images: await this.signPlaceImages(place.images),
      reviews: place.reviews,

      reviewsCount,

      averageRating: Number(
        averageRating.toFixed(1),
      ),
      cityVerseScore: Number(calculateCityVerseScore(place).toFixed(1)),
    };
  }
}
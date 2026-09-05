import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaceDto } from './dto/create-place.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

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
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { subtype: { contains: search, mode: 'insensitive' } },
        {
          city: {
            name: { contains: search, mode: 'insensitive' },
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
        skip,
        take: safeLimit,
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

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      data: places.map((place) => ({
        ...place,
        reviewsCount: place._count.reviews,
        _count: undefined,
      })),
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
      images: place.images,
      reviews: place.reviews,

      reviewsCount,

      averageRating: Number(
        averageRating.toFixed(1),
      ),
    };
  }
}

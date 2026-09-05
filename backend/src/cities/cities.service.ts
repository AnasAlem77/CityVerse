import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

type PlacesSort =
  | 'name_asc'
  | 'name_desc'
  | 'newest'
  | 'most_reviewed';

@Injectable()
export class CitiesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createCity(data: CreateCityDto) {
    return this.prisma.city.create({
      data: {
        name: data.name,
        country: data.country,
        description: data.description,
        image: data.image,

        featured: data.featured ?? false,
        featuredOrder: data.featuredOrder,

        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  async getCities(page = 1, limit = 12) {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const skip = (safePage - 1) * safeLimit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.city.count(),
      this.prisma.city.findMany({
        skip,
        take: safeLimit,
        orderBy: [
          { name: 'asc' },
          { id: 'asc' },
        ],
        include: {
          _count: {
            select: {
              places: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async getFeaturedCities() {
    return this.prisma.city.findMany({
      where: {
        featured: true,
      },

      orderBy: {
        featuredOrder: 'asc',
      },

      include: {
        _count: {
          select: {
            places: true,
          },
        },
      },
    });
  }

  async getCityById(id: string) {
    const city = await this.prisma.city.findUnique({
      where: {
        id,
      },

      include: {
        _count: {
          select: {
            places: true,
          },
        },
      },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    return city;
  }

  async getCityPlaces(
    cityId: string,
    filters: {
      category?: string;
      subtype?: string;
      search?: string;
      sort?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const city = await this.prisma.city.findUnique({
      where: {
        id: cityId,
      },

      select: {
        id: true,
        name: true,
      },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    const limit = Math.min(
      Math.max(filters.limit ?? 12, 1),
      100,
    );

    const offset = Math.max(
      filters.offset ?? 0,
      0,
    );

    const sort: PlacesSort =
      filters.sort === 'name_desc' ||
      filters.sort === 'newest' ||
      filters.sort === 'most_reviewed'
        ? filters.sort
        : 'name_asc';

    const where: Prisma.PlaceWhereInput = {
      cityId,
    };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.subtype) {
      where.subtype = filters.subtype;
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { subtype: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      sort === 'name_desc'
        ? [
            {
              name: 'desc' as const,
            },
          ]
        : sort === 'newest'
          ? [
              {
                createdAt: 'desc' as const,
              },
            ]
          : sort === 'most_reviewed'
            ? [
                {
                  reviews: {
                    _count: 'desc' as const,
                  },
                },
                {
                  name: 'asc' as const,
                },
              ]
            : [
                {
                  name: 'asc' as const,
                },
              ];

    const [places, total, categories, subtypes] =
      await Promise.all([
        this.prisma.place.findMany({
          where,

          orderBy,

          skip: offset,
          take: limit,

          select: {
            id: true,
            osmId: true,

            name: true,
            description: true,
            category: true,
            subtype: true,

            address: true,
            website: true,
            phone: true,
            openingHours: true,
            cuisine: true,
            wheelchair: true,
            internetAccess: true,

            latitude: true,
            longitude: true,

            cityId: true,

            createdAt: true,
            updatedAt: true,

            _count: {
              select: {
                reviews: true,
              },
            },
          },
        }),

        this.prisma.place.count({
          where,
        }),

        this.prisma.place.findMany({
          where: {
            cityId,
          },

          distinct: ['category'],

          select: {
            category: true,
          },

          orderBy: {
            category: 'asc',
          },
        }),

        this.prisma.place.findMany({
          where: {
            cityId,
            subtype: {
              not: null,
            },
          },
          distinct: ['category', 'subtype'],
          select: {
            category: true,
            subtype: true,
          },
          orderBy: [
            { category: 'asc' },
            { subtype: 'asc' },
          ],
        }),
      ]);

    const data = places.map((place) => ({
      ...place,

      reviewsCount: place._count.reviews,

      averageRating: undefined,

      _count: undefined,
    }));

    return {
      city,

      data,

      categories: categories
        .map((item) => item.category)
        .filter(Boolean),

      subtypes: subtypes
        .filter((item) => item.subtype)
        .map((item) => ({
          category: item.category,
          value: item.subtype as string,
        })),

      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + places.length < total,
        currentPage:
          Math.floor(offset / limit) + 1,
        totalPages:
          Math.ceil(total / limit),
      },

      filters: {
        category: filters.category ?? null,
        subtype: filters.subtype ?? null,
        search: filters.search?.trim() || null,
        sort,
      },
    };
  }

  async updateCity(
    id: string,
    data: UpdateCityDto,
  ) {
    return this.prisma.city.update({
      where: {
        id,
      },

      data,
    });
  }

  async deleteCity(id: string) {
    return this.prisma.city.delete({
      where: {
        id,
      },
    });
  }
}

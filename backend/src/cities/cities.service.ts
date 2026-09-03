import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

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

  async getCities() {
    return this.prisma.city.findMany({
      orderBy: {
        name: 'asc',
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
      search?: string;
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
      Math.max(filters.limit ?? 50, 1),
      100,
    );

    const offset = Math.max(
      filters.offset ?? 0,
      0,
    );

    const where: {
      cityId: string;
      category?: string;
      name?: {
        contains: string;
        mode: 'insensitive';
      };
    } = {
      cityId,
    };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    const [places, total] = await Promise.all([
      this.prisma.place.findMany({
        where,

        orderBy: {
          name: 'asc',
        },

        skip: offset,
        take: limit,

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

          cityId: true,

          createdAt: true,
          updatedAt: true,
        },
      }),

      this.prisma.place.count({
        where,
      }),
    ]);

    return {
      city,

      data: places,

      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + places.length < total,
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

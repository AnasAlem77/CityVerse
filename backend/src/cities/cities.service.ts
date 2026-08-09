import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCities() {
    return this.prisma.city.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }
}

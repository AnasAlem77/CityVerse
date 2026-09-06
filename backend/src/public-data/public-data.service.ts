import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NwsProvider } from './nws.provider';
@Injectable()
export class PublicDataService { constructor(private readonly prisma: PrismaService, private readonly provider: NwsProvider) {} async getAlerts(cityId: string) { const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { latitude: true, longitude: true } }); if (!city) throw new NotFoundException('City not found'); return this.provider.getAlerts(Number(city.latitude), Number(city.longitude)); } }

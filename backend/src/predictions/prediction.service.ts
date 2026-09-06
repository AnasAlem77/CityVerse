import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prediction, PredictionStatus } from './prediction.types';

const TYPES = ['traffic', 'activity', 'hotspot', 'demand', 'incident'];

@Injectable()
export class PredictionService {
  constructor(private readonly prisma: PrismaService) {}

  async capabilities() {
    return { available: false, statuses: Object.fromEntries(TYPES.map((type) => [type, 'PREDICTION_UNAVAILABLE' as PredictionStatus])), reason: 'Historical traffic, mobility, event, and incident observations are not stored, so no validated production model can run.' };
  }

  async predict(cityId: string, type: string, horizon = 'next-15-minutes'): Promise<Prediction> {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw new NotFoundException('City not found');
    const safeType = TYPES.includes(type) ? type : 'unknown';
    return { type: safeType, cityId, target: safeType, horizon, generatedAt: new Date().toISOString(), status: 'PREDICTION_UNAVAILABLE', value: null, model: { name: 'not-configured', version: 'none' }, features: [], reason: 'PREDICTION_UNAVAILABLE: insufficient historical observations and no validated model are available.' };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateCityVerseScore } from '../places/cityverse-score';

@Injectable()
export class AssistantContextService {
  constructor(private readonly prisma: PrismaService) {}
  async places(filters: { cityId?: string; category?: string; subtype?: string; search?: string; latitude?: number; longitude?: number; placeIds?: string[] }) {
    const where: any = {};
    if (filters.cityId) where.cityId = filters.cityId;
    if (filters.category) where.category = filters.category;
    if (filters.subtype) where.subtype = filters.subtype;
    if (filters.placeIds?.length) where.id = { in: filters.placeIds.slice(0, 20) };
    if (filters.search?.trim()) where.name = { contains: filters.search.trim(), mode: 'insensitive' };
    if (filters.latitude !== undefined && filters.longitude !== undefined) { where.latitude = { gte: filters.latitude - 0.35, lte: filters.latitude + 0.35 }; where.longitude = { gte: filters.longitude - 0.35, lte: filters.longitude + 0.35 }; }
    const places = await this.prisma.place.findMany({ where, take: 20, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, description: true, category: true, subtype: true, address: true, latitude: true, longitude: true, cityId: true, osmId: true, website: true, phone: true, openingHours: true, cuisine: true, wheelchair: true, internetAccess: true, _count: { select: { reviews: true } } } });
    const orderedPlaces = filters.placeIds?.length ? filters.placeIds.map((id) => places.find((place) => place.id === id)).filter((place): place is (typeof places)[number] => Boolean(place)) : places;
    return orderedPlaces.map((place) => ({ placeId: place.id, name: place.name, category: place.category, subtype: place.subtype, description: place.description, address: place.address, cityId: place.cityId, latitude: place.latitude, longitude: place.longitude, cityVerseScore: calculateCityVerseScore(place), reviewCount: place._count.reviews }));
  }
  async city(cityId: string) { return this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true, name: true, country: true, description: true, latitude: true, longitude: true, timezone: true, _count: { select: { places: true } } } }); }
  async resolve(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
    const text = message.toLowerCase();
    const contextText = [...history.filter((item) => item.role === 'user').map((item) => item.content), message].join(' ').toLowerCase();
    const cities = await this.prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const city = cities.find((item) => contextText.includes(item.name.toLowerCase()));
    const categories = await this.prisma.place.findMany({ distinct: ['category'], select: { category: true } });
    const synonyms: Record<string, string> = { restaurants: 'restaurant', 'places to eat': 'restaurant', 'where can i eat': 'restaurant', hotels: 'hotel', shops: 'shop', stores: 'shop', hospitals: 'hospital', attractions: 'attraction', 'arabic food': 'restaurant' };
    const containsWord = (value: string) => new RegExp(`\\b${value.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\b`, 'i').test(contextText);
    const category = categories.map((item) => item.category).find((value) => containsWord(value)) ?? Object.entries(synonyms).find(([term]) => contextText.includes(term))?.[1];
    const subtypes = await this.prisma.place.findMany({ where: category ? { category } : undefined, distinct: ['category', 'subtype'], select: { category: true, subtype: true } });
    const subtypeAliases: Record<string, string[]> = { coffee: ['coffee', 'cafe', 'café', 'coffee shop', 'place for coffee'], gift: ['gift', 'gifts', 'gift shop', 'buy gifts', 'place that sells gifts'], laundry: ['wash my clothes', 'wash clothes', 'laundry', 'laundromat'], dry_cleaning: ['dry clean', 'dry cleaning'], beach: ['beach', 'by the beach'] };
    const aliasMatch = Object.entries(subtypeAliases).find(([, aliases]) => aliases.some((alias) => contextText.includes(alias)));
    const subtypeMatch = aliasMatch ? subtypes.find((item) => item.subtype?.toLowerCase() === aliasMatch[0]) : subtypes.find((item) => item.subtype && contextText.includes(item.subtype.toLowerCase()));
    const resolvedCategory = category ?? subtypeMatch?.category;
    const unsupportedTerm = aliasMatch && !subtypeMatch ? aliasMatch[0] : undefined;
    return { cityId: city?.id, cityName: city?.name, category: resolvedCategory, subtype: subtypeMatch?.subtype, search: undefined, unsupportedTerm };
  }
  async details(placeId: string) {
    const place = await this.prisma.place.findUnique({ where: { id: placeId }, select: { id: true, name: true, category: true, subtype: true, description: true, address: true, website: true, phone: true, openingHours: true, cuisine: true, wheelchair: true, internetAccess: true, latitude: true, longitude: true, cityId: true, osmId: true, images: { select: { url: true } }, reviews: { select: { rating: true } }, _count: { select: { reviews: true } } } });
    if (!place) return null;
    return { ...place, cityVerseScore: calculateCityVerseScore(place), averageRating: place.reviews.length ? Number((place.reviews.reduce((sum, item) => sum + item.rating, 0) / place.reviews.length).toFixed(1)) : null, reviewCount: place._count.reviews, reviews: undefined, _count: undefined };
  }
}

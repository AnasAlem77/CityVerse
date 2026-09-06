export type ScoreablePlace = {
  name: string;
  description: string;
  category: string;
  subtype?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  openingHours?: string | null;
  cuisine?: string | null;
  wheelchair?: string | null;
  internetAccess?: string | null;
  osmId?: string | null;
};
export const CITYVERSE_SCORE_VERSION = '20260906-v1';
export function calculateCityVerseScoreBreakdown(place: ScoreablePlace) {
  const quality =
    [
      place.name.trim().length >= 3,
      Number.isFinite(place.osmId ? 1 : 0),
      place.category.length > 0,
      place.description.trim().length >= 16,
    ].filter(Boolean).length * 6;
  const completeness =
    [
      place.address,
      place.website,
      place.phone,
      place.openingHours,
      place.cuisine,
      place.wheelchair,
      place.internetAccess,
    ].filter(Boolean).length * 2;
  const relevance =
    (
      {
        attraction: 20,
        hotel: 16,
        hospital: 16,
        university: 16,
        restaurant: 14,
        shop: 8,
      } as Record<string, number>
    )[place.category] ?? 6;
  const importance = ['attraction', 'hotel', 'hospital', 'university'].includes(
    place.category,
  )
    ? 8
    : 0;
  const rawScore = quality + completeness + relevance + importance;
  const maximumScore = 66;
  return {
    score: Number((Math.min(maximumScore, rawScore) / maximumScore * 20).toFixed(2)),
    qualityScore: Number((quality / 5).toFixed(2)),
    relevanceScore: Number((relevance / 5).toFixed(2)),
    completenessScore: Number((completeness / 5).toFixed(2)),
    importanceScore: Number((importance / 5).toFixed(2)),
  };
}

export function calculateCityVerseScore(place: ScoreablePlace) {
  return calculateCityVerseScoreBreakdown(place).score;
}

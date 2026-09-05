export type CityCoverage = {
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
  tileDegrees: number;
};

// Deliberately explicit, reviewable coverage areas. These are collection
// bounds, not claims about administrative boundaries.
export const CITY_COVERAGE: CityCoverage[] = [
  { name: 'Jakarta', south: -6.45, west: 106.65, north: -6.05, east: 107.05, tileDegrees: 0.10 },
  { name: 'Bali', south: -8.85, west: 114.40, north: -8.00, east: 115.80, tileDegrees: 0.20 },
  { name: 'Paris', south: 48.78, west: 2.15, north: 48.98, east: 2.55, tileDegrees: 0.10 },
  { name: 'Dubai', south: 24.85, west: 54.90, north: 25.45, east: 55.65, tileDegrees: 0.15 },
  { name: 'Tokyo', south: 35.45, west: 139.45, north: 35.95, east: 140.10, tileDegrees: 0.15 },
];

export function getCityCoverage(cityName: string) {
  return CITY_COVERAGE.find(
    (coverage) => coverage.name.toLowerCase() === cityName.toLowerCase(),
  );
}

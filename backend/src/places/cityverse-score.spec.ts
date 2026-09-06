import { calculateCityVerseScore } from './cityverse-score';

describe('CityVerse Score', () => {
  const base = {
    name: 'Local Restaurant',
    description: '',
    category: 'restaurant',
    subtype: null,
    address: null,
    website: null,
    phone: null,
    openingHours: null,
    cuisine: null,
    wheelchair: null,
    internetAccess: null,
    osmId: 'node/1',
  };
  it('is deterministic and bounded', () => {
    const first = calculateCityVerseScore(base);
    expect(first).toBe(calculateCityVerseScore({ ...base }));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(20);
  });
  it('does not require complete metadata', () => {
    expect(calculateCityVerseScore(base)).toBeGreaterThan(0);
  });
  it('rewards data quality without calling it a user rating', () => {
    expect(
      calculateCityVerseScore({
        ...base,
        address: '1 Main Street',
        website: 'https://example.com',
        phone: '+1 555 0100',
        openingHours: 'Mo-Fr',
        cuisine: 'local',
      }),
    ).toBeGreaterThan(calculateCityVerseScore(base));
  });
});

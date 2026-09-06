export type MatchInput = {
  name: string;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  category: string;
  subtype: string | null;
};

export type GoogleCandidate = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  types?: string[];
};

export function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizePhone(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

export function hostname(value: string | null | undefined) {
  if (!value) return '';
  try {
    return new URL(
      value.startsWith('http') ? value : `https://${value}`,
    ).hostname
      .toLowerCase()
      .replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function tokenSimilarity(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = new Set(normalizeText(left).split(' ').filter(Boolean));
  const b = new Set(normalizeText(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return (2 * intersection) / (a.size + b.size);
}

export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB?: number,
  longitudeB?: number,
) {
  if (!Number.isFinite(latitudeB) || !Number.isFinite(longitudeB))
    return Number.POSITIVE_INFINITY;
  const targetLatitude = latitudeB as number;
  const targetLongitude = longitudeB as number;
  const radians = Math.PI / 180;
  const dLat = (targetLatitude - latitudeA) * radians;
  const dLon = (targetLongitude - longitudeA) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latitudeA * radians) *
      Math.cos(targetLatitude * radians) *
      Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildQuery(input: MatchInput) {
  return [input.name, input.subtype, input.category, input.city, input.address]
    .filter(Boolean)
    .join(', ');
}

export function scoreCandidate(input: MatchInput, candidate: GoogleCandidate) {
  const name = tokenSimilarity(input.name, candidate.displayName?.text);
  const address = tokenSimilarity(input.address, candidate.formattedAddress);
  const distance = distanceMeters(
    input.latitude,
    input.longitude,
    candidate.location?.latitude,
    candidate.location?.longitude,
  );
  const distanceScore =
    distance <= 250
      ? 1
      : distance <= 1000
        ? 0.8
        : distance <= 5000
          ? 0.45
          : distance <= 15000
            ? 0.15
            : 0;
  const phone =
    normalizePhone(input.phone) &&
    normalizePhone(input.phone) ===
      normalizePhone(candidate.nationalPhoneNumber)
      ? 1
      : 0;
  const website =
    hostname(input.website) &&
    hostname(input.website) === hostname(candidate.websiteUri)
      ? 1
      : 0;
  const city = tokenSimilarity(input.city, candidate.formattedAddress);
  const category = (candidate.types ?? []).some((type) =>
    normalizeText(type).includes(normalizeText(input.category)),
  )
    ? 1
    : 0.35;
  const confidence = Math.min(
    1,
    name * 0.35 +
      address * 0.15 +
      distanceScore * 0.25 +
      phone * 0.12 +
      website * 0.08 +
      city * 0.03 +
      category * 0.02,
  );
  return {
    confidence,
    name,
    address,
    distance,
    distanceScore,
    phone,
    website,
    city,
    category,
  };
}

export function classifyMatch(confidence: number, distance: number) {
  if (distance > 15000 || confidence < 0.45) return 'NO_MATCH' as const;
  if (confidence < 0.72) return 'LOW_CONFIDENCE' as const;
  return 'MATCHED' as const;
}

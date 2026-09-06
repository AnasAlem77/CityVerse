import 'dotenv/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  buildQuery,
  classifyMatch,
  scoreCandidate,
  type GoogleCandidate,
  type MatchInput,
} from '../src/google/google-matching';

const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith('--limit='))?.split('=')[1];
const limit = Math.min(100, Math.max(1, Number(limitArg ?? 25)));
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
const fieldMask =
  'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.types';

function value(value: Prisma.Decimal | number | null) {
  return value == null ? null : Number(value);
}

async function searchGoogle(
  query: string,
  input: MatchInput,
): Promise<GoogleCandidate[]> {
  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey!,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: input.latitude, longitude: input.longitude },
            radius: 15000,
          },
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `Google Places ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  const payload = (await response.json()) as { places?: GoogleCandidate[] };
  return payload.places ?? [];
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const places = await prisma.curatedPlace.findMany({
    where: {
      OR: [{ googleMatch: null }, { googleMatch: { matchStatus: 'FAILED' } }],
    },
    orderBy: [{ cityId: 'asc' }, { id: 'asc' }],
    take: limit,
    include: { rawPlace: true, city: true, googleMatch: true },
  });
  const report = {
    requested: limit,
    processed: 0,
    matched: 0,
    noMatch: 0,
    lowConfidence: 0,
    failed: 0,
    skipped: 0,
    apiCalls: 0,
    confidences: [] as number[],
    examples: [] as Array<Record<string, unknown>>,
  };
  if (!apiKey) {
    report.skipped = places.length;
    console.log(
      JSON.stringify({
        ...report,
        reason: 'GOOGLE_MAPS_API_KEY is not configured; dry run only.',
      }),
    );
    await prisma.$disconnect();
    return;
  }
  for (const place of places) {
    const input: MatchInput = {
      name: place.rawPlace.name,
      city: place.city.name,
      address: place.rawPlace.address,
      latitude: value(place.rawPlace.latitude)!,
      longitude: value(place.rawPlace.longitude)!,
      phone: place.rawPlace.phone,
      website: place.rawPlace.website,
      category: place.rawPlace.category,
      subtype: place.rawPlace.subtype,
    };
    const query = buildQuery(input);
    try {
      const candidates = await searchGoogle(query, input);
      report.apiCalls += 1;
      const ranked = candidates
        .map((candidate) => ({
          candidate,
          score: scoreCandidate(input, candidate),
        }))
        .sort(
          (a, b) =>
            b.score.confidence - a.score.confidence ||
            (a.candidate.id ?? '').localeCompare(b.candidate.id ?? ''),
        );
      const best = ranked[0];
      const status = best
        ? classifyMatch(best.score.confidence, best.score.distance)
        : 'NO_MATCH';
      const data = {
        searchQuery: query,
        candidateData: candidates,
        matchStatus: status,
        confidenceScore: best?.score.confidence ?? null,
        googlePlaceId:
          status === 'MATCHED' ? (best?.candidate.id ?? null) : null,
        matchedName:
          status === 'MATCHED'
            ? (best?.candidate.displayName?.text ?? null)
            : null,
        matchedAddress:
          status === 'MATCHED'
            ? (best?.candidate.formattedAddress ?? null)
            : null,
        matchedLatitude:
          status === 'MATCHED'
            ? (best?.candidate.location?.latitude ?? null)
            : null,
        matchedLongitude:
          status === 'MATCHED'
            ? (best?.candidate.location?.longitude ?? null)
            : null,
        matchedPhone:
          status === 'MATCHED'
            ? (best?.candidate.nationalPhoneNumber ?? null)
            : null,
        matchedWebsite:
          status === 'MATCHED' ? (best?.candidate.websiteUri ?? null) : null,
        googleMapsUrl:
          status === 'MATCHED' ? (best?.candidate.googleMapsUri ?? null) : null,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        failureReason:
          status === 'NO_MATCH'
            ? 'No candidate met the geographic/name confidence gate.'
            : status === 'LOW_CONFIDENCE'
              ? 'Best candidate remained ambiguous below the acceptance threshold.'
              : null,
      };
      const { attempts: _attempts, ...matchData } = data;
      await prisma.googlePlaceMatch.upsert({
        where: { curatedPlaceId: place.id },
        create: { curatedPlaceId: place.id, ...matchData, attempts: 1 },
        update: data,
      });
      report.processed += 1;
      report[
        status === 'MATCHED'
          ? 'matched'
          : status === 'NO_MATCH'
            ? 'noMatch'
            : 'lowConfidence'
      ] += 1;
      if (best) {
        report.confidences.push(best.score.confidence);
        if (report.examples.length < 5)
          report.examples.push({
            source: input.name,
            city: input.city,
            query,
            candidate: best.candidate.displayName?.text,
            googlePlaceId: best.candidate.id,
            confidence: best.score.confidence,
            distanceMeters: best.score.distance,
            status,
          });
      }
    } catch (error) {
      report.failed += 1;
      report.processed += 1;
      await prisma.googlePlaceMatch.upsert({
        where: { curatedPlaceId: place.id },
        create: {
          curatedPlaceId: place.id,
          matchStatus: 'FAILED',
          searchQuery: query,
          attempts: 1,
          lastAttemptAt: new Date(),
          failureReason: error instanceof Error ? error.message : String(error),
        },
        update: {
          matchStatus: 'FAILED',
          searchQuery: query,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          failureReason: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  console.log(
    JSON.stringify({
      ...report,
      averageConfidence: report.confidences.length
        ? report.confidences.reduce((a, b) => a + b, 0) /
          report.confidences.length
        : null,
      minConfidence: report.confidences.length
        ? Math.min(...report.confidences)
        : null,
      maxConfidence: report.confidences.length
        ? Math.max(...report.confidences)
        : null,
    }),
  );
  await prisma.$disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

ALTER TABLE "City" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
UPDATE "City" SET "timezone" = CASE "name"
  WHEN 'Jakarta' THEN 'Asia/Jakarta'
  WHEN 'Bali' THEN 'Asia/Makassar'
  WHEN 'Paris' THEN 'Europe/Paris'
  WHEN 'Dubai' THEN 'Asia/Dubai'
  WHEN 'Tokyo' THEN 'Asia/Tokyo'
  ELSE "timezone"
END;
ALTER TABLE "PlaceImage" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PlaceImage" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "PlaceImage" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "PlaceImage" ADD COLUMN "license" TEXT;
ALTER TABLE "PlaceImage" ADD COLUMN "author" TEXT;
ALTER TABLE "PlaceImage" ADD COLUMN "attribution" TEXT;
ALTER TABLE "PlaceImage" ADD COLUMN "width" INTEGER;
ALTER TABLE "PlaceImage" ADD COLUMN "height" INTEGER;

CREATE TABLE "CityVerseScore" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "qualityScore" DOUBLE PRECISION NOT NULL,
  "relevanceScore" DOUBLE PRECISION NOT NULL,
  "completenessScore" DOUBLE PRECISION NOT NULL,
  "importanceScore" DOUBLE PRECISION NOT NULL,
  "formulaVersion" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CityVerseScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CityVerseScore_placeId_key" ON "CityVerseScore"("placeId");
ALTER TABLE "CityVerseScore" ADD CONSTRAINT "CityVerseScore_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlaceRating" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlaceRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlaceRating_userId_placeId_key" ON "PlaceRating"("userId", "placeId");
CREATE INDEX "PlaceRating_placeId_idx" ON "PlaceRating"("placeId");
ALTER TABLE "PlaceRating" ADD CONSTRAINT "PlaceRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaceRating" ADD CONSTRAINT "PlaceRating_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CuratedPlacePhoto" (
  "id" TEXT NOT NULL,
  "curatedPlaceId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "license" TEXT,
  "author" TEXT,
  "attribution" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "confidenceScore" DOUBLE PRECISION,
  "matchStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "failureReason" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuratedPlacePhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuratedPlacePhoto_curatedPlaceId_imageUrl_key" ON "CuratedPlacePhoto"("curatedPlaceId", "imageUrl");
CREATE INDEX "CuratedPlacePhoto_curatedPlaceId_matchStatus_idx" ON "CuratedPlacePhoto"("curatedPlaceId", "matchStatus");
ALTER TABLE "CuratedPlacePhoto" ADD CONSTRAINT "CuratedPlacePhoto_curatedPlaceId_fkey" FOREIGN KEY ("curatedPlaceId") REFERENCES "CuratedPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

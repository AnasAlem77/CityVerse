-- CreateEnum
CREATE TYPE "GoogleMatchStatus" AS ENUM ('PENDING', 'SEARCHED', 'MATCHED', 'NO_MATCH', 'LOW_CONFIDENCE', 'FAILED');

-- CreateTable
CREATE TABLE "GooglePlaceMatch" (
    "id" TEXT NOT NULL,
    "curatedPlaceId" TEXT NOT NULL,
    "googlePlaceId" TEXT,
    "matchStatus" "GoogleMatchStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION,
    "matchedName" TEXT,
    "matchedAddress" TEXT,
    "matchedLatitude" DECIMAL(9,6),
    "matchedLongitude" DECIMAL(9,6),
    "matchedPhone" TEXT,
    "matchedWebsite" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "googleMapsUrl" TEXT,
    "photoReferences" JSONB,
    "searchQuery" TEXT,
    "candidateData" JSONB,
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GooglePlaceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GooglePlaceMatch_curatedPlaceId_key" ON "GooglePlaceMatch"("curatedPlaceId");
CREATE INDEX "GooglePlaceMatch_matchStatus_updatedAt_idx" ON "GooglePlaceMatch"("matchStatus", "updatedAt");
CREATE INDEX "GooglePlaceMatch_googlePlaceId_idx" ON "GooglePlaceMatch"("googlePlaceId");

-- AddForeignKey
ALTER TABLE "GooglePlaceMatch" ADD CONSTRAINT "GooglePlaceMatch_curatedPlaceId_fkey" FOREIGN KEY ("curatedPlaceId") REFERENCES "CuratedPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

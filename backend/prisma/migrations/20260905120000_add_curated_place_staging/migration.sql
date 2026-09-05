CREATE TABLE "CuratedPlace" (
    "id" TEXT NOT NULL,
    "rawPlaceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuratedPlace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuratedPlace_rawPlaceId_key" ON "CuratedPlace"("rawPlaceId");
CREATE INDEX "CuratedPlace_cityId_qualityScore_idx" ON "CuratedPlace"("cityId", "qualityScore");
ALTER TABLE "CuratedPlace" ADD CONSTRAINT "CuratedPlace_rawPlaceId_fkey" FOREIGN KEY ("rawPlaceId") REFERENCES "RawPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuratedPlace" ADD CONSTRAINT "CuratedPlace_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

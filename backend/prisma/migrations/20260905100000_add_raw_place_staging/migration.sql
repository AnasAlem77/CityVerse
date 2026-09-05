CREATE TABLE "RawPlace" (
    "id" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subtype" TEXT,
    "rawTags" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "openingHours" TEXT,
    "cuisine" TEXT,
    "wheelchair" TEXT,
    "internetAccess" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawPlace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RawPlace_cityId_osmId_key" ON "RawPlace"("cityId", "osmId");
CREATE INDEX "RawPlace_cityId_category_subtype_idx" ON "RawPlace"("cityId", "category", "subtype");
ALTER TABLE "RawPlace" ADD CONSTRAINT "RawPlace_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

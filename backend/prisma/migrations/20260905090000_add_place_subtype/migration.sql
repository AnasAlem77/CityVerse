-- Additive OSM subtype support. Existing places remain valid with NULL subtype.
ALTER TABLE "Place" ADD COLUMN "subtype" TEXT;

CREATE INDEX "Place_cityId_category_subtype_idx"
ON "Place"("cityId", "category", "subtype");

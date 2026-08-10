/*
  Warnings:

  - Made the column `description` on table `Place` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Place" ALTER COLUMN "description" SET NOT NULL;

-- CreateTable
CREATE TABLE "PlaceImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlaceImage" ADD CONSTRAINT "PlaceImage_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

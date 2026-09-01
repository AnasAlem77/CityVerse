/*
  Warnings:

  - A unique constraint covering the columns `[osmId]` on the table `Place` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "osmId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Place_osmId_key" ON "Place"("osmId");

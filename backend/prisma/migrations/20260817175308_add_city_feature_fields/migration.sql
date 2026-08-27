-- AlterTable
ALTER TABLE "City" ADD COLUMN     "description" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featuredOrder" INTEGER,
ADD COLUMN     "image" TEXT;

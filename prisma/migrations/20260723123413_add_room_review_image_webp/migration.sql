-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "imageUpdatedAt" TIMESTAMPTZ,
ADD COLUMN     "imageWebp" BYTEA;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "imageUpdatedAt" TIMESTAMPTZ,
ADD COLUMN     "imageWebp" BYTEA;

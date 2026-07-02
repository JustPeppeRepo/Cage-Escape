-- CreateEnum
CREATE TYPE "ScheduleOverrideType" AS ENUM ('CLOSED', 'CUSTOM_HOURS');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prezzoTotale" DECIMAL(65,30) NOT NULL,
    "prezzoCaparra" DECIMAL(65,30) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "minPlayers" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleOverride" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "roomId" TEXT,
    "type" "ScheduleOverrideType" NOT NULL,
    "openHour" INTEGER,
    "closeHour" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add new Booking columns (nullable first for migration safety)
ALTER TABLE "Booking" ADD COLUMN "roomId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "holdExpiresAt" TIMESTAMPTZ;
ALTER TABLE "Booking" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentChoice" "PaymentType";
ALTER TABLE "Booking" ADD COLUMN "participantCount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "minorCount" INTEGER NOT NULL DEFAULT 0;

-- Delete orphan bookings without room (dev safety)
DELETE FROM "Payment" WHERE "bookingId" IN (SELECT "id" FROM "Booking");
DELETE FROM "Booking";

-- Make required columns NOT NULL
ALTER TABLE "Booking" ALTER COLUMN "roomId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "paymentChoice" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "participantCount" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleOverride_date_roomId_key" ON "ScheduleOverride"("date", "roomId");

-- CreateIndex
CREATE INDEX "ScheduleOverride_date_idx" ON "ScheduleOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripeSessionId_key" ON "Booking"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Booking_roomId_startTime_endTime_idx" ON "Booking"("roomId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Booking_holdExpiresAt_idx" ON "Booking"("holdExpiresAt");

-- AddForeignKey
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace global overlap constraint with per-room constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_no_overlap;

ALTER TABLE "Booking"
ADD CONSTRAINT booking_no_overlap_per_room
EXCLUDE USING gist (
  "roomId" WITH =,
  tstzrange("startTime", "endTime") WITH &&
)
WHERE (status IN ('PENDING', 'DEPOSIT_PAID', 'PAID'));

-- CreateTable
CREATE TABLE "BookingWaiver" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "minorIndex" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingWaiver_bookingId_idx" ON "BookingWaiver"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingWaiver_bookingId_minorIndex_key" ON "BookingWaiver"("bookingId", "minorIndex");

-- AddForeignKey
ALTER TABLE "BookingWaiver" ADD CONSTRAINT "BookingWaiver_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

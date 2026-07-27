-- CreateTable
CREATE TABLE "WeeklyOpeningHours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openHour" INTEGER NOT NULL DEFAULT 10,
    "closeHour" INTEGER NOT NULL DEFAULT 22,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WeeklyOpeningHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyOpeningHours_dayOfWeek_key" ON "WeeklyOpeningHours"("dayOfWeek");

-- Seed default week: lun–dom aperti 10:00–22:00 (allineato a DEFAULT_OPEN/CLOSE_HOUR)
INSERT INTO "WeeklyOpeningHours" ("id", "dayOfWeek", "isOpen", "openHour", "closeHour", "updatedAt")
VALUES
  ('woh_mon_default', 0, true, 10, 22, CURRENT_TIMESTAMP),
  ('woh_tue_default', 1, true, 10, 22, CURRENT_TIMESTAMP),
  ('woh_wed_default', 2, true, 10, 22, CURRENT_TIMESTAMP),
  ('woh_thu_default', 3, true, 10, 22, CURRENT_TIMESTAMP),
  ('woh_fri_default', 4, true, 10, 22, CURRENT_TIMESTAMP),
  ('woh_sat_default', 5, true, 10, 22, CURRENT_TIMESTAMP),
  ('woh_sun_default', 6, true, 10, 22, CURRENT_TIMESTAMP);

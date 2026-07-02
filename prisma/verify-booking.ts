import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getAvailableSlotsForRoom } from "@/app/_lib/bookings/slots";
import { BookingStatus, PaymentType } from "@/generated/prisma/client";
import { HOLD_DURATION_MS } from "@/app/_lib/bookings/constants";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function verifyAvailability() {
  const room = await prisma.room.findUnique({ where: { slug: "il-manicomio" } });
  if (!room) {
    throw new Error("Room seed non trovata");
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const slots = await getAvailableSlotsForRoom(
    room.id,
    room.durationMinutes,
    dateStr,
  );

  console.log(`[verify] Slot disponibili per ${dateStr}: ${slots.length}`);
  if (slots.length === 0) {
    throw new Error("Nessuno slot generato");
  }

  return { room, slot: slots[0], dateStr };
}

async function ensureTestUsers() {
  // Righe User "nude" (senza Account/password): sufficienti per il test di
  // race condition sulle prenotazioni, che non passa dal login Better Auth.
  const userA = await prisma.user.upsert({
    where: { email: "verify-a@cageroom.test" },
    update: {},
    create: {
      name: "Verify A",
      username: "verify_a",
      email: "verify-a@cageroom.test",
      phone: "0000000001",
    },
  });

  const userB = await prisma.user.upsert({
    where: { email: "verify-b@cageroom.test" },
    update: {},
    create: {
      name: "Verify B",
      username: "verify_b",
      email: "verify-b@cageroom.test",
      phone: "0000000002",
    },
  });

  return { userA, userB };
}

async function verifyRaceCondition(
  roomId: string,
  userAId: string,
  userBId: string,
  slotStart: Date,
  slotEnd: Date,
) {
  const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);

  const attempts = await Promise.allSettled([
    prisma.booking.create({
      data: {
        userId: userAId,
        roomId,
        startTime: slotStart,
        endTime: slotEnd,
        totalAmount: 120,
        status: BookingStatus.PENDING,
        holdExpiresAt,
        paymentChoice: PaymentType.FULL,
        participantCount: 2,
        minorCount: 0,
      },
    }),
    prisma.booking.create({
      data: {
        userId: userBId,
        roomId,
        startTime: slotStart,
        endTime: slotEnd,
        totalAmount: 120,
        status: BookingStatus.PENDING,
        holdExpiresAt,
        paymentChoice: PaymentType.FULL,
        participantCount: 2,
        minorCount: 0,
      },
    }),
  ]);

  const successes = attempts.filter((result) => result.status === "fulfilled");
  const failures = attempts.filter((result) => result.status === "rejected");

  console.log(
    `[verify] Race condition: successi=${successes.length}, fallimenti=${failures.length}`,
  );

  if (successes.length !== 1 || failures.length !== 1) {
    throw new Error("Race condition non gestita correttamente");
  }

  await prisma.booking.deleteMany({
    where: {
      roomId,
      startTime: slotStart,
      endTime: slotEnd,
    },
  });
}

async function main() {
  const { room, slot } = await verifyAvailability();
  const { userA, userB } = await ensureTestUsers();

  await verifyRaceCondition(
    room.id,
    userA.id,
    userB.id,
    slot.startTime,
    slot.endTime,
  );

  console.log("[verify] Tutti i controlli superati");
}

main()
  .catch((error) => {
    console.error("[verify] Errore:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

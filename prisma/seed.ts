import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const room = await prisma.room.upsert({
    where: { slug: "il-manicomio" },
    update: {},
    create: {
      slug: "il-manicomio",
      name: "Il Manicomio",
      description:
        "Una escape room horror immersiva in un manicomio abbandonato. Solo per i più coraggiosi.",
      prezzoTotale: 120,
      prezzoCaparra: 40,
      durationMinutes: 90,
      minPlayers: 2,
      maxPlayers: 6,
      terrorLevel: 5,
      isActive: true,
    },
  });

  // deleteMany + createMany invece di nested upsert: rende il seed
  // idempotente anche quando le fasce di prezzo cambiano tra un run e l'altro.
  await prisma.roomPricingTier.deleteMany({ where: { roomId: room.id } });
  await prisma.roomPricingTier.createMany({
    data: [
      {
        roomId: room.id,
        minParticipants: 2,
        maxParticipants: 3,
        totalPrice: 90,
        depositPrice: 30,
      },
      {
        roomId: room.id,
        minParticipants: 4,
        maxParticipants: 5,
        totalPrice: 130,
        depositPrice: 40,
      },
      {
        roomId: room.id,
        minParticipants: 6,
        maxParticipants: 6,
        totalPrice: 150,
        depositPrice: 50,
      },
    ],
  });

  const seedReviews = [
    {
      author: "Marco T.",
      quote: "Non dormo più la notte. Consigliatissimo.",
      rotation: -4,
      sortOrder: 0,
      isPublished: true,
    },
    {
      author: "Giulia R.",
      quote: "Il livello di dettaglio è agghiacciante.",
      rotation: 3,
      sortOrder: 1,
      isPublished: true,
    },
    {
      author: "Luca P.",
      quote: "Ci siamo salvati per un pelo. Torneremo.",
      rotation: -2,
      sortOrder: 2,
      isPublished: true,
    },
  ];

  await prisma.review.deleteMany();
  await prisma.review.createMany({ data: seedReviews });

  // Orari settimanali di default (lun–dom 10–22), idempotente.
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    await prisma.weeklyOpeningHours.upsert({
      where: { dayOfWeek },
      update: {},
      create: {
        dayOfWeek,
        isOpen: true,
        openHour: 10,
        closeHour: 22,
      },
    });
  }

  console.log("Seed completato:", room.slug);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

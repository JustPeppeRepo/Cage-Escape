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

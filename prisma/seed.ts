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
      isActive: true,
    },
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

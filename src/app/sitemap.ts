import type { MetadataRoute } from "next";
import { prisma } from "@/app/_lib/prisma";
import { env } from "@/app/_lib/env";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (MAINTENANCE.enabled) {
    return [];
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  let rooms: { slug: string; updatedAt: Date }[] = [];
  try {
    rooms = await prisma.room.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    // Sitemap statica se il DB non è raggiungibile in build.
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/rooms`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contatti`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const roomRoutes: MetadataRoute.Sitemap = rooms.map((room) => ({
    url: `${baseUrl}/rooms/${room.slug}`,
    lastModified: room.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...roomRoutes];
}

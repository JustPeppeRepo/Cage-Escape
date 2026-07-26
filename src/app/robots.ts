import type { MetadataRoute } from "next";
import { env } from "@/app/_lib/env";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";

export default function robots(): MetadataRoute.Robots {
  if (MAINTENANCE.enabled) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/checkout/",
        "/login",
        "/signup",
        "/maledizione",
        "/api/",
      ],
    },
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}

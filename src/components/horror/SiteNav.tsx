"use client";

import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SiteNavClient } from "@/components/horror/SiteNavClient";

export type SiteNavUser = {
  name: string;
  username: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

function toNavUser(user: {
  name: string;
  username?: string | null;
  email: string;
  image?: string | null;
  role?: string | null;
}): SiteNavUser {
  return {
    name: user.name,
    username:
      typeof user.username === "string" ? user.username : user.name,
    email: user.email,
    image: user.image ?? null,
    isAdmin: user.role === "ADMIN",
  };
}

export function SiteNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const navUser = session?.user ? toNavUser(session.user) : null;

  return <SiteNavClient user={navUser} />;
}

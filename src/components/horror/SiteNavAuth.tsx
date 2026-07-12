"use client";

import { authClient } from "@/lib/auth-client";
import { SiteNavClient } from "@/components/horror/SiteNavClient";
import type { SiteNavUser } from "@/components/horror/SiteNav";

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

export function SiteNavAuth() {
  const { data: session } = authClient.useSession();
  const navUser = session?.user ? toNavUser(session.user) : null;

  return <SiteNavClient user={navUser} />;
}

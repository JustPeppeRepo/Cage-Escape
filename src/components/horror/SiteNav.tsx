"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SiteNavClient } from "@/components/horror/SiteNavClient";
import { createClient } from "@/utils/supabase/client";

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
  const [navUser, setNavUser] = useState<SiteNavUser | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setNavUser(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, username, email, image, role")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (!profile) {
        setNavUser(
          toNavUser({
            name: user.email ?? "",
            email: user.email ?? "",
          }),
        );
        return;
      }

      setNavUser(
        toNavUser({
          name: profile.name,
          username: profile.username,
          email: profile.email ?? user.email ?? "",
          image: profile.image,
          role: profile.role,
        }),
      );
    }

    void loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return <SiteNavClient user={navUser} />;
}

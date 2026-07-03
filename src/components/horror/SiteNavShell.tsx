"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type SiteNavShellProps = {
  children: ReactNode;
};

export function SiteNavShell({ children }: SiteNavShellProps) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return children;
}

"use client";

import { useState } from "react";
import { clearClientSessionAndGoHome } from "@/lib/clear-client-session";

type LogoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function LogoutButton({
  className,
  children = "Esci",
}: LogoutButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      await clearClientSessionAndGoHome();
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={className}
    >
      {children}
    </button>
  );
}

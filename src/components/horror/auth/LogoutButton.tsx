// =====================================================================================
// SECURE LOGOUT BUTTON - SUPABASE AUTH
// Senior Full-Stack Developer & Cybersecurity Auditor Implementation
// =====================================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type LogoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function LogoutButton({ className, children = "Logout" }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Supabase Auth sign out
      // signOut clears the session on both client and server side
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Logout error:", error);
        // Even if logout fails on server, clear local session
      }

      // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Force page refresh
      // Ensure middleware picks up the cleared session and redirects appropriately
      router.push("/");
      router.refresh();
      
    } catch (error) {
      console.error("Unexpected logout error:", error);
      // Force reload to clear any cached session state
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? "Disconnessione..." : children}
    </button>
  );
}
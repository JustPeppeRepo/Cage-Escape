"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import {
  getAvatarUrlById,
  resolveAvatarId,
} from "@/app/_lib/account/avatars";
import type { SiteNavUser } from "@/components/horror/SiteNav";

type SiteNavClientProps = {
  user: SiteNavUser | null;
};

const navLinks = [
  { href: "/rooms", label: "Stanze" },
  { href: "/about", label: "Chi siamo" },
  { href: "/contatti", label: "Contatti" },
];

function getAvatarUrl(image: string | null): string {
  return getAvatarUrlById(resolveAvatarId(image));
}

function UserAccountLink({
  user,
  onNavigate,
  compact,
}: {
  user: SiteNavUser;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const avatarUrl = getAvatarUrl(user.image);

  if (compact) {
    return (
      <Link
        href="/account"
        onClick={onNavigate}
        title={user.email}
        className="group flex items-center gap-3 rounded border border-void-mist px-3 py-2 transition-colors hover:border-blood/50"
      >
        <img
          src={avatarUrl}
          alt=""
          className="h-9 w-9 rounded-full bg-void-mist"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm text-bone">{user.username}</span>
          <span className="block truncate text-xs text-bone/50">{user.email}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      onClick={onNavigate}
      title={`${user.username} · ${user.email}`}
      className="group flex min-w-0 flex-col items-center gap-0.5 rounded border border-void-mist px-2 py-1 transition-colors hover:border-blood/50"
    >
      <img
        src={avatarUrl}
        alt=""
        className="h-8 w-8 rounded-full bg-void-mist"
      />
      <span className="max-w-[4.5rem] truncate text-[10px] leading-tight text-bone/60 group-hover:text-bone/80">
        {user.username}
      </span>
    </Link>
  );
}

function AdminLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      aria-label="Area admin"
      title="Admin"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-void-mist font-mono text-[11px] leading-none text-bone/70 transition-colors hover:border-blood/50 hover:text-bone"
    >
      {"</>"}
    </Link>
  );
}

function NavAuthSection({
  user,
  onNavigate,
  compact,
}: {
  user: SiteNavUser | null;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const stackClass = compact
    ? "flex flex-col gap-3 border-t border-void-mist pt-4"
    : "flex items-center gap-2";

  if (user) {
    return (
      <div className={stackClass}>
        <UserAccountLink user={user} onNavigate={onNavigate} compact={compact} />
        {user.isAdmin ? <AdminLink onNavigate={onNavigate} /> : null}
        <form action={logout} className={compact ? undefined : "shrink-0"}>
          <button
            type="submit"
            className={
              compact
                ? "rounded bg-void-mist px-3 py-1.5 text-bone/80 transition-colors hover:bg-blood/30 hover:text-bone"
                : "rounded bg-void-mist px-2.5 py-1.5 text-xs text-bone/80 transition-colors hover:bg-blood/30 hover:text-bone"
            }
          >
            Esci
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={stackClass}>
      <Link
        href="/login"
        onClick={onNavigate}
        className="text-bone/70 transition-colors hover:text-bone"
      >
        Accedi
      </Link>
      <Link
        href="/signup"
        onClick={onNavigate}
        className="rounded bg-blood px-3 py-1.5 text-bone transition-colors hover:bg-blood-bright"
      >
        Registrati
      </Link>
    </div>
  );
}

export function SiteNavClient({ user }: SiteNavClientProps) {
  const pathname = usePathname();
  const [menuOpenByPath, setMenuOpenByPath] = useState<Record<string, boolean>>(
    {},
  );

  const menuOpen = menuOpenByPath[pathname] ?? false;

  function setMenuOpen(open: boolean) {
    setMenuOpenByPath((prev) => ({ ...prev, [pathname]: open }));
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-void-mist bg-void/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] md:justify-normal">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg text-blood-bright transition-colors hover:text-blood sm:text-xl md:justify-self-start"
        >
          Cage Room
        </Link>

        <nav
          aria-label="Navigazione principale"
          className="hidden items-center gap-4 text-sm text-bone/70 md:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-bone"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden justify-self-end text-sm md:flex">
          <NavAuthSection user={user} />
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-void-mist text-bone md:hidden"
          aria-expanded={menuOpen}
          aria-controls="site-nav-mobile-menu"
          aria-label={menuOpen ? "Chiudi menu di navigazione" : "Apri menu di navigazione"}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="sr-only">
            {menuOpen ? "Chiudi menu" : "Apri menu"}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-none stroke-current stroke-2"
          >
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      <div
        id="site-nav-mobile-menu"
        hidden={!menuOpen}
        className="border-t border-void-mist bg-void/98 px-4 py-4 md:hidden"
      >
        <nav
          aria-label="Navigazione principale mobile"
          className="flex flex-col gap-3 text-sm text-bone/80"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="rounded px-2 py-2 transition-colors hover:bg-void-mist hover:text-bone"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 text-sm">
          <NavAuthSection user={user} onNavigate={closeMenu} compact />
        </div>
      </div>
    </header>
  );
}

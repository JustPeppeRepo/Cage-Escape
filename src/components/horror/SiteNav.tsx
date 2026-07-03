import Link from "next/link";
import { logout } from "@/actions/auth";

export type SiteNavUser = {
  name: string;
  email: string;
  isAdmin: boolean;
};

type SiteNavProps = {
  user: SiteNavUser | null;
};

const navLinks = [
  { href: "/rooms", label: "Stanze" },
  { href: "/about", label: "Chi siamo" },
  { href: "/contatti", label: "Contatti" },
];

export function SiteNav({ user }: SiteNavProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-void-mist bg-void/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-xl text-blood-bright transition-colors hover:text-blood"
          >
            Cage Room
          </Link>

          <nav
            aria-label="Navigazione principale"
            className="flex flex-wrap items-center gap-4 text-sm text-bone/70"
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
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          {user ? (
            <>
              <div className="text-right leading-tight">
                <p className="text-bone">{user.name}</p>
                <p className="text-xs text-bone/50">{user.email}</p>
              </div>
              {user.isAdmin ? (
                <Link
                  href="/admin"
                  className="rounded border border-void-mist px-3 py-1.5 text-bone/80 transition-colors hover:border-blood/50 hover:text-bone"
                >
                  Admin
                </Link>
              ) : null}
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded bg-void-mist px-3 py-1.5 text-bone/80 transition-colors hover:bg-blood/30 hover:text-bone"
                >
                  Esci
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-bone/70 transition-colors hover:text-bone"
              >
                Accedi
              </Link>
              <Link
                href="/signup"
                className="rounded bg-blood px-3 py-1.5 text-bone transition-colors hover:bg-blood-bright"
              >
                Registrati
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

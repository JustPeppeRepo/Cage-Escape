import Link from "next/link";
import { logout } from "@/actions/auth";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/rooms", label: "Stanze" },
  { href: "/admin/schedule", label: "Orari" },
  { href: "/admin/bookings", label: "Prenotazioni" },
  { href: "/admin/impostazioni", label: "Impostazioni" },
];

export function AdminNav() {
  return (
    <nav className="flex flex-col gap-1 border-r border-void-mist bg-void-deep p-4">
      <p className="mb-4 font-[family-name:var(--font-display)] text-xl text-blood-bright">
        Admin
      </p>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded px-3 py-2 text-sm text-bone/80 transition-colors hover:bg-void-mist hover:text-bone"
        >
          {link.label}
        </Link>
      ))}
      <Link
        href="/"
        className="mt-6 rounded px-3 py-2 text-sm text-bone/50 hover:text-bone/80"
      >
        ← Torna al sito
      </Link>
      <form action={logout} className="mt-2">
        <button
          type="submit"
          className="w-full rounded px-3 py-2 text-left text-sm text-bone/50 transition-colors hover:bg-void-mist hover:text-bone/80"
        >
          Esci
        </button>
      </form>
    </nav>
  );
}

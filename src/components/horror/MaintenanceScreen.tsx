import Image from "next/image";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";

/** Pagina muta: brand + messaggio, nessun link, form o tracker UI. */
export function MaintenanceScreen() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-void-deep px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(133,32,38,0.22)_0%,transparent_55%),linear-gradient(180deg,#030303_0%,#0a0a0a_45%,#120808_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(232,226,214,0.15)_2px,rgba(232,226,214,0.15)_3px)]"
      />

      <div className="relative z-10 flex max-w-lg flex-col items-center gap-8">
        <Image
          src="/icon-trasparent.png"
          alt={MAINTENANCE.brand}
          width={112}
          height={112}
          priority
          className="h-24 w-24 object-contain sm:h-28 sm:w-28"
        />

        <div className="flex flex-col items-center gap-3">
          <p className="font-heading text-sm tracking-[0.35em] text-bone/55 uppercase">
            {MAINTENANCE.brand}
          </p>
          <h1 className="animate-flicker font-heading text-4xl text-blood-bright sm:text-5xl">
            {MAINTENANCE.headline}
          </h1>
          <p className="max-w-md text-base leading-relaxed text-bone/75 sm:text-lg">
            {MAINTENANCE.message}
          </p>
        </div>
      </div>
    </main>
  );
}

"use client";

export function FogOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="animate-fog-drift absolute -inset-x-1/4 top-1/3 h-64 rounded-full bg-void-mist/60 blur-3xl" />
      <div
        className="animate-fog-drift absolute -inset-x-1/3 top-1/2 h-72 rounded-full bg-void-mist/40 blur-3xl"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  );
}

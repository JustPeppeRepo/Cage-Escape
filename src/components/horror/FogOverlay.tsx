export function FogOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="animate-fog-drift absolute left-1/2 top-1/3 h-64 w-[min(90%,28rem)] -translate-x-1/2 rounded-full bg-void-mist/40 blur-3xl sm:w-[min(80%,32rem)]" />
      <div
        className="animate-fog-drift absolute left-1/2 top-1/2 h-72 w-[min(95%,32rem)] -translate-x-1/2 rounded-full bg-void-mist/25 blur-3xl sm:w-[min(85%,36rem)]"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  );
}

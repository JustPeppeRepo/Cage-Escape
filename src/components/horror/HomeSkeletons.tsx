export function RoomsSectionSkeleton() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <div className="h-3 w-32 animate-pulse rounded bg-void-mist" />
        <div className="h-8 w-48 animate-pulse rounded bg-void-mist" />
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse rounded-md border border-void-mist bg-void-deep"
          />
        ))}
      </div>
    </section>
  );
}

export function ReviewsSectionSkeleton() {
  return (
    <section className="overflow-hidden bg-void-deep py-16 sm:py-24">
      <div className="mb-10 flex flex-col items-center gap-2 px-4 text-center sm:px-6">
        <div className="h-3 w-40 animate-pulse rounded bg-void-mist" />
        <div className="h-8 w-64 animate-pulse rounded bg-void-mist" />
      </div>
      <div className="flex gap-5 overflow-hidden px-4 sm:gap-6 sm:px-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-72 w-72 shrink-0 animate-pulse rounded-md border border-void-mist bg-void sm:w-80"
          />
        ))}
      </div>
    </section>
  );
}

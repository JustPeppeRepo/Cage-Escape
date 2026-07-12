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
            className="h-56 animate-pulse rounded-md border border-void-mist bg-void-deep"
          />
        ))}
      </div>
    </section>
  );
}

export function ReviewsSectionSkeleton() {
  return (
    <section className="bg-void-deep px-4 py-16 sm:px-6 sm:py-24">
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <div className="h-3 w-40 animate-pulse rounded bg-void-mist" />
        <div className="h-8 w-64 animate-pulse rounded bg-void-mist" />
      </div>
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-8">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-48 w-56 animate-pulse rounded bg-void-mist/40"
          />
        ))}
      </div>
    </section>
  );
}

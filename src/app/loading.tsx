export default function Loading() {
  return (
    <main>
      <section className="flex min-h-[90vh] items-center justify-center bg-void-deep px-6">
        <div className="flex max-w-3xl flex-col items-center gap-6">
          <div className="h-12 w-72 max-w-full animate-pulse rounded bg-void-mist sm:h-16 sm:w-96" />
          <div className="h-5 w-full max-w-xl animate-pulse rounded bg-void-mist/60" />
          <div className="h-12 w-56 animate-pulse rounded bg-void-mist/40" />
        </div>
      </section>
    </main>
  );
}

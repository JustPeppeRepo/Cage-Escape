"use client";

import dynamic from "next/dynamic";

const BookingWidget = dynamic(
  () =>
    import("@/components/horror/booking/BookingWidget").then(
      (mod) => mod.BookingWidget,
    ),
  {
    loading: () => (
      <div
        className="h-96 animate-pulse rounded-md border border-void-mist bg-void-deep"
        aria-hidden
      />
    ),
  },
);

export { BookingWidget };

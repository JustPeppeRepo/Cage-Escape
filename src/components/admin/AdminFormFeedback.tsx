"use client";

import type { AdminActionResult } from "@/app/_lib/admin/action-result";

type AdminFormFeedbackProps = {
  state: AdminActionResult | null;
};

export function AdminFormFeedback({ state }: AdminFormFeedbackProps) {
  if (!state) {
    return null;
  }

  if (state.success) {
    return (
      <p className="rounded border border-ectoplasm/30 bg-ectoplasm/10 px-3 py-2 text-sm text-ectoplasm">
        {state.message ?? "Operazione completata"}
      </p>
    );
  }

  return (
    <p className="rounded border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood-bright">
      {state.error}
    </p>
  );
}

export const adminInputClassName =
  "rounded border border-void-mist bg-void px-3 py-2 text-bone w-full";

export const adminLabelClassName = "flex flex-col gap-1 text-sm text-bone/80";

export const adminButtonClassName =
  "rounded bg-blood px-4 py-2 text-sm text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50";

export const adminSecondaryButtonClassName =
  "rounded border border-void-mist px-4 py-2 text-sm text-bone/80 transition-colors hover:border-bone/40 hover:text-bone";

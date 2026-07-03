"use client";

import { useActionState } from "react";
import { deleteRoom } from "@/app/_actions/admin/rooms";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";

type DeleteRoomButtonProps = {
  roomId: string;
};

export function DeleteRoomButton({ roomId }: DeleteRoomButtonProps) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | null,
    FormData
  >(deleteRoom, null);

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="roomId" value={roomId} readOnly />
      <AdminFormFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-blood-bright hover:underline"
      >
        {pending ? "Eliminazione…" : "Elimina stanza"}
      </button>
    </form>
  );
}

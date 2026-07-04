"use client";

import { useActionState } from "react";
import {
  deleteContactMessage,
  setContactMessageRead,
} from "@/app/_actions/admin/contact";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import {
  AdminFormFeedback,
  adminButtonClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin/AdminFormFeedback";

type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  read: boolean;
  createdAt: string;
};

type ContactMessagesManagerProps = {
  messages: ContactMessageRow[];
};

export function ContactMessagesManager({ messages }: ContactMessagesManagerProps) {
  if (messages.length === 0) {
    return <p className="text-sm text-bone/60">Nessun messaggio ricevuto.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {messages.map((message) => (
        <ContactMessageRowItem key={message.id} message={message} />
      ))}
    </ul>
  );
}

function ContactMessageRowItem({ message }: { message: ContactMessageRow }) {
  const [readState, readAction, readPending] = useActionState<
    AdminActionResult | null,
    FormData
  >(setContactMessageRead, null);
  const [deleteState, deleteAction, deletePending] = useActionState<
    AdminActionResult | null,
    FormData
  >(deleteContactMessage, null);

  return (
    <li
      className={`rounded border p-4 ${
        message.read ? "border-void-mist" : "border-blood/60 bg-blood/5"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm text-bone">
            <span className="font-semibold">{message.name}</span>{" "}
            <span className="text-bone/50">&lt;{message.email}&gt;</span>
          </p>
          {message.subject ? (
            <p className="text-sm text-bone/70">{message.subject}</p>
          ) : null}
        </div>
        <p className="text-xs text-bone/40">{message.createdAt}</p>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-bone/80">
        {message.message}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={readAction}>
          <input type="hidden" name="messageId" value={message.id} readOnly />
          <input
            type="hidden"
            name="read"
            value={message.read ? "false" : "true"}
            readOnly
          />
          <button type="submit" disabled={readPending} className={adminButtonClassName}>
            {readPending
              ? "Aggiornamento…"
              : message.read
                ? "Segna da leggere"
                : "Segna come letto"}
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="messageId" value={message.id} readOnly />
          <button
            type="submit"
            disabled={deletePending}
            className={adminSecondaryButtonClassName}
          >
            {deletePending ? "Eliminazione…" : "Elimina"}
          </button>
        </form>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <AdminFormFeedback state={readState} />
        <AdminFormFeedback state={deleteState} />
      </div>
    </li>
  );
}

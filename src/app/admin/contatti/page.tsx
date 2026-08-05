/**
 * Inbox contatti `/admin/contatti`
 *
 * @description Messaggi dal form pubblico: lettura/eliminazione.
 * @components ContactMessagesManager
 * @actions setContactMessageRead, deleteContactMessage
 * @auth requireAdmin
 * @seo noindex
 */
import type { Metadata } from "next";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { ContactMessagesManager } from "@/components/admin/ContactMessagesManager";

export const metadata: Metadata = {
  title: "Messaggi | Admin",
  robots: { index: false, follow: false },
};

const DATETIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminContattiPage() {
  await requireAdmin();

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  const unreadCount = messages.filter((message) => !message.read).length;

  const serializedMessages = messages.map((message) => ({
    id: message.id,
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    read: message.read,
    createdAt: DATETIME_FORMATTER.format(message.createdAt),
  }));

  return (
    <main>
      <h1 className="font-heading text-3xl text-blood-bright">
        Messaggi
      </h1>
      <p className="mt-2 text-sm text-bone/60">
        Messaggi inviati dal modulo contatti del sito.
        {unreadCount > 0
          ? ` ${unreadCount} da leggere.`
          : " Tutti letti."}
      </p>

      <div className="mt-8">
        <ContactMessagesManager messages={serializedMessages} />
      </div>
    </main>
  );
}

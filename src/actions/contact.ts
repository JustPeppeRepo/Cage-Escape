"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/_lib/prisma";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import { contactFormSchema } from "@/app/_lib/admin/schemas";
import { sendContactNotificationEmail } from "@/app/_lib/contact/email";
import { logError } from "@/lib/logger";

export type ContactActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export async function submitContact(
  prevState: ContactActionState | null,
  formData: FormData,
): Promise<ContactActionState> {
  const rateLimit = await checkRateLimit("contact", 5);
  if (!rateLimit.allowed) {
    return {
      errors: {
        message: [
          `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
        ],
      },
    };
  }

  const parsed = contactFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") || undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { name, email, subject, message } = parsed.data;

  try {
    await prisma.contactMessage.create({
      data: { name, email, subject, message },
    });

    const emailResult = await sendContactNotificationEmail({
      name,
      email,
      subject,
      message,
    });

    if (!emailResult.ok) {
      if (emailResult.skipped) {
        return {
          success: true,
          message:
            "Messaggio registrato. Ti risponderemo appena possibile.",
        };
      }
      logError("contact", "Messaggio salvato ma email non inviata", {
        email,
      });
      return {
        success: true,
        message:
          "Messaggio registrato. Se non ricevi risposta entro 48 ore, contattaci telefonicamente.",
      };
    }

    revalidatePath("/contatti");

    return {
      success: true,
      message: "Il tuo messaggio è stato inviato. Ti risponderemo presto… se osi aspettare.",
    };
  } catch (error) {
    logError("contact", "submitContact failed", error);
    return {
      errors: {
        message: ["Qualcosa è andato storto durante l'invio. Riprova più tardi."],
      },
    };
  }
}

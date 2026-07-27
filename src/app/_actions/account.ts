"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";
import { BookingStatus } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/app/_lib/prisma";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/app/_lib/account/schemas";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";

const GENERIC_RESET_MESSAGE =
  "Se l'email esiste nel nostro sistema, riceverai un link per reimpostare la password.";

async function countBlockingBookings(userId: string): Promise<number> {
  const now = new Date();

  return prisma.booking.count({
    where: {
      userId,
      OR: [
        { status: BookingStatus.PAID },
        { status: BookingStatus.DEPOSIT_PAID },
        { status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED },
        {
          status: BookingStatus.PENDING,
          holdExpiresAt: { gt: now },
        },
      ],
    },
  });
}

async function deleteDeletableBookings(userId: string): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const deletableBookings = await tx.booking.findMany({
      where: {
        userId,
        OR: [
          {
            status: {
              in: [BookingStatus.CANCELLED, BookingStatus.COMPLETED],
            },
          },
          {
            status: BookingStatus.PENDING,
            OR: [{ holdExpiresAt: null }, { holdExpiresAt: { lte: now } }],
          },
        ],
      },
      select: { id: true },
    });

    if (deletableBookings.length === 0) {
      return;
    }

    const bookingIds = deletableBookings.map((booking) => booking.id);

    await tx.payment.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await tx.booking.deleteMany({
      where: { id: { in: bookingIds } },
    });
  });
}

export async function changePassword(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await requireUser();

  const rateLimit = await checkRateLimit("changePassword", 5, {
    userId: session.user.id,
  });
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
    };
  }

  const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { success: false, error: "Password attuale non corretta" };
    }
    console.error("[account/changePassword] Unexpected error:", error);
    return { success: false, error: "Errore durante il cambio password" };
  }

  return { success: true, message: "Password aggiornata" };
}

export async function requestPasswordReset(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const rateLimit = await checkRateLimit("forgot-password", 5);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
    };
  }

  const parsed = forgotPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        // Path relativo: passa originCheck con allowRelativePaths e evita
        // INVALID_CALLBACK_URL se BETTER_AUTH_URL in prod non combacia.
        redirectTo: "/reset-password",
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.message.includes("RESET_PASSWORD_DISABLED")) {
        return {
          success: false,
          error: "Recupero password temporaneamente non disponibile",
        };
      }
    }
    console.error("[account/requestPasswordReset] Unexpected error:", error);
  }

  return { success: true, message: GENERIC_RESET_MESSAGE };
}

export async function resetPassword(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const rateLimit = await checkRateLimit("reset-password", 5);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
    };
  }

  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { token, newPassword } = parsed.data;

  try {
    await auth.api.resetPassword({
      body: { token, newPassword },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        success: false,
        error: "Link non valido o scaduto. Richiedi un nuovo reset.",
      };
    }
    console.error("[account/resetPassword] Unexpected error:", error);
    return { success: false, error: "Errore durante il reset della password" };
  }

  redirect("/login?reset=success");
}

export async function deleteAccount(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await requireUser();

  // Senza questo limite un utente autenticato potrebbe tentare ripetutamente
  // deleteAccount con password diverse per indovinarla via brute-force: i
  // rate limit nativi di Better Auth su /delete-user non scattano qui
  // perché la chiamata e' server-side diretta (stesso motivo di login/signup).
  const rateLimit = await checkRateLimit("deleteAccount", 3, {
    userId: session.user.id,
  });
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
    };
  }

  const parsed = deleteAccountSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { confirmEmail, password } = parsed.data;

  if (confirmEmail.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    return {
      success: false,
      error: "L'email di conferma non coincide con il tuo account",
    };
  }

  const blockingCount = await countBlockingBookings(session.user.id);
  if (blockingCount > 0) {
    return {
      success: false,
      error:
        "Hai prenotazioni attive o pagate; contattaci prima di eliminare l'account.",
    };
  }

  // Verifichiamo la password PRIMA di eliminare qualunque dato: se e'
  // errata, le prenotazioni cancellabili dell'utente restano intatte invece
  // di essere eliminate inutilmente prima che deleteUser scopra l'errore.
  try {
    await auth.api.verifyPassword({
      body: { password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { success: false, error: "Password non corretta" };
    }
    console.error("[account/deleteAccount] Password verification failed:", error);
    return { success: false, error: "Errore durante l'eliminazione dell'account" };
  }

  try {
    await deleteDeletableBookings(session.user.id);

    await auth.api.deleteUser({
      body: { password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { success: false, error: "Password non corretta" };
    }
    console.error("[account/deleteAccount] Unexpected error:", error);
    return { success: false, error: "Errore durante l'eliminazione dell'account" };
  }

  // Niente redirect server: il client deve fare signOut + hard navigation
  // per azzerare useSession in navbar (stesso problema del logout).
  return { success: true, message: "Account eliminato" };
}

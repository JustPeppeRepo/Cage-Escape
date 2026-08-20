"use server";

import { redirect } from "next/navigation";
import { BookingStatus } from "@/generated/prisma/client";
import { validateUserSession } from "@/utils/supabase/auth-validation";
import { createClient } from "@/utils/supabase/server";
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
  try {
    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Server Action re-authorization check
    // NEVER trust client-side user context. Always re-validate session server-side.
    const user = await validateUserSession();

    const rateLimit = await checkRateLimit("changePassword", 5, {
      userId: user.id,
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

    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Supabase Auth password update
    const supabase = await createClient();
    
    // First verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      return { success: false, error: "Password attuale non corretta" };
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[account/changePassword] Update error:", updateError);
      return { success: false, error: "Errore durante il cambio password" };
    }

    return { success: true, message: "Password aggiornata" };
  } catch (error) {
    console.error("[account/changePassword] Unexpected error:", error);
    return { 
      success: false, 
      error: error instanceof Error && error.message === "Unauthorized" 
        ? "Sessione scaduta" 
        : "Errore durante il cambio password" 
    };
  }
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
    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Supabase Auth password reset
    const supabase = await createClient();
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error("[account/requestPasswordReset] Reset error:", error);
      // Don't expose specific error details for security
    }
  } catch (error) {
    console.error("[account/requestPasswordReset] Unexpected error:", error);
  }

  // Always return success to prevent email enumeration
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
    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Supabase Auth password reset update
    // Note: This requires the user to be in a password reset session
    // The token validation is handled by Supabase Auth service
    const supabase = await createClient();
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("[account/resetPassword] Update error:", error);
      return {
        success: false,
        error: "Link non valido o scaduto. Richiedi un nuovo reset.",
      };
    }
  } catch (error) {
    console.error("[account/resetPassword] Unexpected error:", error);
    return { success: false, error: "Errore durante il reset della password" };
  }

  redirect("/login?reset=success");
}

export async function deleteAccount(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  try {
    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Server Action re-authorization check
    const user = await validateUserSession();

    const rateLimit = await checkRateLimit("deleteAccount", 3, {
      userId: user.id,
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

    if (confirmEmail.trim().toLowerCase() !== user.email!.toLowerCase()) {
      return {
        success: false,
        error: "L'email di conferma non coincide con il tuo account",
      };
    }

    const blockingCount = await countBlockingBookings(user.id);
    if (blockingCount > 0) {
      return {
        success: false,
        error:
          "Hai prenotazioni attive o pagate; contattaci prima di eliminare l'account.",
      };
    }

    // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Password verification
    const supabase = await createClient();
    
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (verifyError) {
      return { success: false, error: "Password non corretta" };
    }

    try {
      await deleteDeletableBookings(user.id);

      // ⚠️ CRITICAL SECURITY CHECK [TOKEN_VALIDATION]: Delete user from Supabase Auth
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error("[account/deleteAccount] Delete error:", deleteError);
        return { success: false, error: "Errore durante l'eliminazione dell'account" };
      }

      return { success: true, message: "Account eliminato" };
    } catch (error) {
      console.error("[account/deleteAccount] Unexpected error:", error);
      return { success: false, error: "Errore durante l'eliminazione dell'account" };
    }
  } catch (error) {
    console.error("[account/deleteAccount] Authentication error:", error);
    return { 
      success: false, 
      error: error instanceof Error && error.message === "Unauthorized" 
        ? "Sessione scaduta" 
        : "Errore durante l'eliminazione dell'account" 
    };
  }
}

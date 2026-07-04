"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import { getSiteSettings } from "@/app/_lib/admin/site-settings";
import { generateDiscountCodeValue } from "@/app/_lib/admin/discount";
import { getCurrentSession, requireUser } from "@/lib/dal";
import { generateDiscountCodeSchema } from "@/app/_lib/admin/schemas";
import { logError } from "@/lib/logger";

const PUZZLE_ANSWER = "VIII";
const CODE_VALIDITY_DAYS = 7;

export type MaledizioneActionState = {
  success?: boolean;
  error?: string;
  code?: string;
  discountPercent?: number;
  sealed?: boolean;
};

export async function generateDiscountCode(
  prevState: MaledizioneActionState | null,
  formData: FormData,
): Promise<MaledizioneActionState> {
  const rateLimit = await checkRateLimit("generateDiscountCode", 3);
  if (!rateLimit.allowed) {
    return {
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
    };
  }

  const session = await requireUser();

  const settings = await getSiteSettings();
  if (!settings.easterEggDiscountEnabled) {
    return {
      sealed: true,
      error: "Il rito è sigillato. Nessuna ricompensa ti attende… per ora.",
    };
  }

  const parsed = generateDiscountCodeSchema.safeParse({
    puzzleAnswer: formData.get("puzzleAnswer"),
  });

  if (!parsed.success) {
    return { error: "Risposta non valida" };
  }

  if (parsed.data.puzzleAnswer.trim().toUpperCase() !== PUZZLE_ANSWER) {
    return { error: "L'enigma resiste. Osserva meglio nell'oscurità." };
  }

  try {
    const existingCode = await prisma.discountCode.findFirst({
      where: {
        userId: session.user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingCode) {
      return {
        success: true,
        code: existingCode.code,
        discountPercent: existingCode.discountPercent,
      };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CODE_VALIDITY_DAYS);

    let code = generateDiscountCodeValue();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const created = await prisma.discountCode.create({
          data: {
            code,
            discountPercent: settings.easterEggDiscountPercent,
            userId: session.user.id,
            expiresAt,
          },
        });

        return {
          success: true,
          code: created.code,
          discountPercent: created.discountPercent,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          code = generateDiscountCodeValue();
          continue;
        }
        throw error;
      }
    }

    return { error: "Impossibile generare il codice. Riprova." };
  } catch (error) {
    logError("maledizione", "generateDiscountCode failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { error: "Qualcosa è andato storto durante il rito." };
  }
}

export async function getMaledizionePageData() {
  const session = await getCurrentSession();
  const settings = await getSiteSettings();

  let existingCode: string | null = null;
  if (session?.user?.id) {
    const code = await prisma.discountCode.findFirst({
      where: {
        userId: session.user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      select: { code: true },
    });
    existingCode = code?.code ?? null;
  }

  return {
    isLoggedIn: !!session?.user,
    discountEnabled: settings.easterEggDiscountEnabled,
    discountPercent: settings.easterEggDiscountPercent,
    existingCode,
  };
}

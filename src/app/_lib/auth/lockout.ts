import { prisma } from "@/app/_lib/prisma";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function getLoginLockStatus(email: string): Promise<{
  locked: boolean;
  retryAfterSeconds?: number;
}> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { lockedUntil: true },
  });

  if (!user?.lockedUntil) {
    return { locked: false };
  }

  const now = Date.now();
  if (user.lockedUntil.getTime() <= now) {
    return { locked: false };
  }

  return {
    locked: true,
    retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - now) / 1000),
  };
}

export async function recordFailedLoginAttempt(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return;
  }

  // Incremento atomico lato DB invece di leggere il contatore e riscriverlo:
  // sotto tentativi concorrenti (piu' richieste di login fallite in
  // parallelo, come in un attacco brute-force) un semplice read-then-write
  // perderebbe incrementi (race condition), indebolendo il lockout proprio
  // nello scenario che dovrebbe proteggere.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
    });
  }
}

export async function resetLoginAttempts(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, failedLoginAttempts: true, lockedUntil: true },
  });

  if (!user) {
    return;
  }

  if (user.failedLoginAttempts === 0 && !user.lockedUntil) {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

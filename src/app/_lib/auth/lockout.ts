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
    select: { id: true, failedLoginAttempts: true },
  });

  if (!user) {
    return;
  }

  const failedLoginAttempts = user.failedLoginAttempts + 1;
  const lockedUntil =
    failedLoginAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_DURATION_MS)
      : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts,
      lockedUntil,
    },
  });
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

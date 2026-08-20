/**
 * Lockout tentativi login.
 * I campi failedLoginAttempts/lockedUntil appartenevano alla tabella Better Auth
 * `user` e non esistono su `profiles`. Il rate limit in prepareLogin resta attivo.
 */
export async function getLoginLockStatus(_email: string): Promise<{
  locked: boolean;
  retryAfterSeconds?: number;
}> {
  return { locked: false };
}

export async function recordFailedLoginAttempt(_email: string): Promise<void> {
  return;
}

export async function resetLoginAttempts(_email: string): Promise<void> {
  return;
}

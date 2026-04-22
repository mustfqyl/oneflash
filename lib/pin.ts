import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(
  pin: string,
  hashedPin: string
): Promise<boolean> {
  return bcrypt.compare(pin, hashedPin);
}

// In-memory lockout store (per-user)
const lockouts = new Map<string, { attempts: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

export function checkLockout(userId: string): {
  locked: boolean;
  remainingMs: number;
} {
  const record = lockouts.get(userId);
  if (!record) return { locked: false, remainingMs: 0 };

  if (record.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: record.lockedUntil - Date.now() };
  }

  // Lockout expired, reset
  if (record.attempts >= MAX_ATTEMPTS) {
    lockouts.delete(userId);
  }

  return { locked: false, remainingMs: 0 };
}

export function recordFailedAttempt(userId: string): {
  locked: boolean;
  remainingMs: number;
} {
  const record = lockouts.get(userId) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    lockouts.set(userId, record);
    return { locked: true, remainingMs: LOCKOUT_DURATION_MS };
  }

  lockouts.set(userId, record);
  return { locked: false, remainingMs: 0 };
}

export function resetLockout(userId: string): void {
  lockouts.delete(userId);
}

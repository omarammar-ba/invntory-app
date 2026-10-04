export const MAX_LOGIN_FAILURES = 10;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_COOLDOWN_MS = 15 * 60 * 1000;

type AttemptRecord = {
  failures: number;
  firstFailedAt: number;
  lockedUntil: number;
};

export type LoginAttemptStatus = {
  remaining: number;
  lockedUntil: number;
};

const memoryFallback = new Map<string, string>();
export const LOGIN_ATTEMPT_STORAGE_PREFIX = 'inventory-login-limit-v2:';

const storageKey = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized.charCodeAt(index);
    first = Math.imul(first ^ character, 0x01000193);
    second = Math.imul(second ^ character, 0x85ebca6b);
  }

  return `${LOGIN_ATTEMPT_STORAGE_PREFIX}${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
};

const readRaw = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key) ?? memoryFallback.get(key) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
};

const writeRaw = (key: string, value: string): void => {
  memoryFallback.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Keep the limit for this tab if browser storage is unavailable.
  }
};

const removeRaw = (key: string): void => {
  memoryFallback.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Browser storage can be disabled; the memory copy is already cleared.
  }
};

const readRecord = (key: string, now: number): AttemptRecord => {
  const raw = readRaw(key);
  if (raw) {
    try {
      const value = JSON.parse(raw) as Partial<AttemptRecord>;
      if (
        Number.isInteger(value.failures) &&
        value.failures! >= 0 &&
        value.failures! <= MAX_LOGIN_FAILURES &&
        Number.isFinite(value.firstFailedAt) &&
        Number.isFinite(value.lockedUntil)
      ) {
        const record = value as AttemptRecord;
        if (record.lockedUntil > now) return record;
        if (!record.lockedUntil && now - record.firstFailedAt < LOGIN_ATTEMPT_WINDOW_MS) {
          return record;
        }
      }
    } catch {
      // An invalid local record should not stop normal sign-in.
    }
    removeRaw(key);
  }

  return { failures: 0, firstFailedAt: 0, lockedUntil: 0 };
};

export const getLoginAttemptStatus = (email: string, now = Date.now()): LoginAttemptStatus => {
  if (!email.trim()) return { remaining: MAX_LOGIN_FAILURES, lockedUntil: 0 };
  const record = readRecord(storageKey(email), now);
  return {
    remaining: Math.max(0, MAX_LOGIN_FAILURES - record.failures),
    lockedUntil: record.lockedUntil,
  };
};

export const recordLoginFailure = (email: string, now = Date.now()): LoginAttemptStatus => {
  const key = storageKey(email);
  const current = readRecord(key, now);
  if (current.lockedUntil > now) return { remaining: 0, lockedUntil: current.lockedUntil };

  const failures = current.failures + 1;
  const lockedUntil = failures >= MAX_LOGIN_FAILURES ? now + LOGIN_COOLDOWN_MS : 0;
  writeRaw(key, JSON.stringify({
    failures,
    firstFailedAt: current.firstFailedAt || now,
    lockedUntil,
  } satisfies AttemptRecord));

  return { remaining: Math.max(0, MAX_LOGIN_FAILURES - failures), lockedUntil };
};

export const startLoginCooldown = (email: string, now = Date.now()): LoginAttemptStatus => {
  const key = storageKey(email);
  const current = readRecord(key, now);
  const lockedUntil = Math.max(current.lockedUntil, now + LOGIN_COOLDOWN_MS);
  writeRaw(key, JSON.stringify({
    failures: MAX_LOGIN_FAILURES,
    firstFailedAt: current.firstFailedAt || now,
    lockedUntil,
  } satisfies AttemptRecord));
  return { remaining: 0, lockedUntil };
};

export const clearLoginAttempts = (email: string): void => {
  if (email.trim()) removeRaw(storageKey(email));
};

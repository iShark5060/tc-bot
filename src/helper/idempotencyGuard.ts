const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MAX_ENTRIES = 5000;
const CLEANUP_INTERVAL_MS = Math.min(60 * 1000, DEFAULT_TTL_MS);

const seenIds = new Map<string, number>();
let cleanupTimer: NodeJS.Timeout | null = null;

function pruneExpired(now: number): void {
  for (const [id, expiresAt] of seenIds) {
    if (expiresAt <= now) {
      seenIds.delete(id);
    }
  }
}

function startPeriodicCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    if (seenIds.size === 0) return;
    const now = Date.now();
    if (seenIds.size >= MAX_ENTRIES) {
      pruneExpired(now);
      return;
    }
    pruneExpired(now);
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

export function isDuplicateEventId(
  id: string,
  ttlMs = DEFAULT_TTL_MS,
): boolean {
  const now = Date.now();

  if (seenIds.size >= MAX_ENTRIES) {
    pruneExpired(now);
  }

  const expiresAt = seenIds.get(id);
  if (expiresAt && expiresAt > now) {
    return true;
  }

  seenIds.set(id, now + ttlMs);
  return false;
}

export function stopIdempotencyCleanup(): void {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = null;
}

startPeriodicCleanup();

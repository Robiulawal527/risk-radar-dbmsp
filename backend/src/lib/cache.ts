/**
 * Very lightweight in-memory TTL cache.
 * Designed for the 50 concurrent users target.
 *
 * We cache the expensive public analytics, rankings, and heatmap data for a short time
 * so that 50 users refreshing their maps/dashboards don't all hammer the database
 * with identical GROUP BY / full-table scans.
 *
 * For a city-scale safety app this is a huge win with almost zero complexity
 * (no Redis needed yet).
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export interface CacheOptions {
  /** Time to live in milliseconds */
  ttlMs: number;
}

/**
 * Get from cache or compute + store.
 */
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const value = await compute();

  store.set(key, {
    value,
    expiresAt: now + options.ttlMs,
  });

  // Opportunistic cleanup (rarely more than a few dozen keys)
  if (store.size > 64) {
    for (const [k, entry] of store.entries()) {
      if ((entry as CacheEntry<unknown>).expiresAt <= now) {
        store.delete(k);
      }
    }
  }

  return value;
}

/**
 * Manually invalidate a key (useful after a new crime report or SOS).
 */
export function invalidate(key: string) {
  store.delete(key);
}

/**
 * Invalidate keys that match a prefix (e.g. 'analytics:', 'heatmap:').
 */
export function invalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear everything (mainly for tests or admin actions).
 */
export function clearAll() {
  store.clear();
}

// Pre-defined TTLs suitable for 50 concurrent users
export const CACHE_TTL = {
  // Public stats / rankings can be slightly stale for a short period
  STATS_AND_RANKINGS: 35_000, // 35 seconds
  HEATMAP: 25_000,            // 25 seconds (map is more real-time sensitive)
  SOCIAL_RADAR: 20_000,
};

import type { TroopRow, CacheEntry } from '../types/index.js';
import type { GoogleSpreadsheet } from 'google-spreadsheet';

import {
  cachedSheetRows,
  googleSheetCacheHits,
  googleSheetCacheMisses,
} from './metrics.js';

const DEFAULT_TTL_MS = Number(process.env.GOOGLE_SHEET_CACHE || 300000);
const cache = new Map<string, CacheEntry>();

function keyFor(doc: GoogleSpreadsheet, sheetId: string): string {
  const docId = doc?.spreadsheetId || 'default';
  return `${docId}:${sheetId}`;
}

async function getSheetRowsCached(
  doc: GoogleSpreadsheet,
  sheetId: string,
  ttlMs?: number,
): Promise<TroopRow[]> {
  const ttl = Number.isFinite(ttlMs) ? Number(ttlMs) : DEFAULT_TTL_MS;
  const key = keyFor(doc, sheetId);
  const now = Date.now();

  const entry = cache.get(key);

  if (entry?.rows && entry.expiresAt && entry.expiresAt > now) {
    googleSheetCacheHits.inc();
    cachedSheetRows.set(cache.size);
    return entry.rows;
  }

  googleSheetCacheMisses.inc();

  if (entry?.loadingPromise) {
    return entry.loadingPromise;
  }

  const loadingPromise = (async (): Promise<TroopRow[]> => {
    let sheet = (doc as unknown as { sheetsById?: Record<string, { getRows: () => Promise<TroopRow[]> }> }).sheetsById?.[sheetId];
    if (!sheet) {
      await doc.loadInfo();
      sheet = (doc as unknown as { sheetsById?: Record<string, { getRows: () => Promise<TroopRow[]> }> }).sheetsById?.[sheetId];
    }
    if (!sheet) throw new Error(`Sheet not found: ${sheetId}`);

    const rows = await sheet.getRows();
    return rows as TroopRow[];
  })();

  cache.set(key, { ...(entry || {}), loadingPromise });

  try {
    const rows = await loadingPromise;
    cache.set(key, { rows, expiresAt: Date.now() + ttl });
    cachedSheetRows.set(cache.size);
    return rows;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

function invalidateSheetCache(sheetId: string, doc?: GoogleSpreadsheet): void {
  if (doc) {
    cache.delete(keyFor(doc, sheetId));
    return;
  }
  for (const k of cache.keys()) {
    if (k.endsWith(`:${sheetId}`)) {
      cache.delete(k);
    }
  }
}

function clearAllSheetCache(): void {
  cache.clear();
}

function getCacheStats(): {
  size: number;
  keys: string[];
  expirations: Array<{ expiresAt: string; hasRows: boolean }>;
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    expirations: Array.from(cache.values()).map((v) => ({
      expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : '',
      hasRows: !!v.rows,
    })),
  };
}

export {
  getSheetRowsCached,
  invalidateSheetCache,
  clearAllSheetCache,
  getCacheStats,
};
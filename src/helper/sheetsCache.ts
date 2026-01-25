import {
  cachedSheetRows,
  googleSheetCacheHits,
  googleSheetCacheMisses,
} from './metrics.js';
import { CacheEntry, GoogleSheetsClient, TroopRow } from '../types/index.js';

const DEFAULT_TTL_MS = Number(process.env.GOOGLE_SHEET_CACHE || 300000);
const cache = new Map<string, CacheEntry>();

function keyFor(client: GoogleSheetsClient, sheetId: string): string {
  return `${client.spreadsheetId}:${sheetId}`;
}

/**
 * Gets sheet rows from cache or fetches from Google Sheets API if cache expired.
 * Implements deduplication - concurrent requests for the same sheet wait for the same promise.
 * @param client - GoogleSheetsClient with authenticated API and spreadsheet ID
 * @param sheetId - The sheet ID (gid) to fetch
 * @param ttlMs - Optional TTL in milliseconds (defaults to GOOGLE_SHEET_CACHE env var or 300000)
 * @returns Promise resolving to array of TroopRow objects
 */
async function getSheetRowsCached(
  client: GoogleSheetsClient,
  sheetId: string,
  ttlMs?: number,
): Promise<TroopRow[]> {
  const ttl = Number.isFinite(ttlMs) ? Number(ttlMs) : DEFAULT_TTL_MS;
  const key = keyFor(client, sheetId);
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
    const response = await client.sheetsApi.spreadsheets.get({
      spreadsheetId: client.spreadsheetId,
      includeGridData: false,
    });

    const sheets = response.data.sheets || [];
    const sheet = sheets.find((s) => String(s.properties?.sheetId) === sheetId);

    if (!sheet?.properties?.title) {
      throw new Error(`Sheet not found: ${sheetId}`);
    }

    const sheetTitle = sheet.properties.title;

    const valuesResponse = await client.sheetsApi.spreadsheets.values.get({
      spreadsheetId: client.spreadsheetId,
      range: sheetTitle,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const values = valuesResponse.data.values || [];

    if (values.length === 0) {
      return [];
    }

    const headers = values[0].map(String);
    const dataRows = values.slice(1);

    return dataRows.map((row) => new TroopRow(headers, row));
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

/**
 * Invalidates cached rows for a specific sheet.
 * @param sheetId - The sheet ID to invalidate
 * @param client - Optional GoogleSheetsClient (if provided, only invalidates that client's cache)
 */
function invalidateSheetCache(sheetId: string, client?: GoogleSheetsClient): void {
  if (client) {
    cache.delete(keyFor(client, sheetId));
    return;
  }
  for (const k of cache.keys()) {
    if (k.endsWith(`:${sheetId}`)) {
      cache.delete(k);
    }
  }
}

/**
 * Clears all cached sheet data.
 */
function clearAllSheetCache(): void {
  cache.clear();
}

/**
 * Gets cache statistics including size, keys, and expiration times.
 * @returns Object with cache size, all keys, and expiration info for each entry
 */
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

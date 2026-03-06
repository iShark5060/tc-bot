import {
  cachedSheetRows,
  googleSheetCacheHits,
  googleSheetCacheMisses,
} from './metrics.js';
import { CacheEntry, GoogleSheetsClient, TroopRow } from '../types/index.js';

const FALLBACK_TTL_MS = 300000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function resolveTtlMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return FALLBACK_TTL_MS;
  return Math.min(Math.floor(parsed), MAX_TTL_MS);
}

const DEFAULT_TTL_MS = resolveTtlMs(process.env.GOOGLE_SHEET_CACHE);
if (
  process.env.GOOGLE_SHEET_CACHE !== undefined &&
  DEFAULT_TTL_MS === FALLBACK_TTL_MS &&
  Number(process.env.GOOGLE_SHEET_CACHE) !== FALLBACK_TTL_MS
) {
  console.warn(
    `[SHEETS:CACHE] Invalid GOOGLE_SHEET_CACHE="${process.env.GOOGLE_SHEET_CACHE}", using fallback ${FALLBACK_TTL_MS}ms`,
  );
}

function keyFor(client: GoogleSheetsClient, sheetId: string): string {
  return `${client.spreadsheetId}:${sheetId}`;
}

async function getSheetRowsCached(
  client: GoogleSheetsClient,
  sheetId: string,
  ttlMs?: number,
): Promise<TroopRow[]> {
  const ttl = ttlMs === undefined ? DEFAULT_TTL_MS : resolveTtlMs(ttlMs);
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
    const escapedTitle = sheetTitle.replace(/'/g, "''");
    const range = `'${escapedTitle}'`;

    const valuesResponse = await client.sheetsApi.spreadsheets.values.get({
      spreadsheetId: client.spreadsheetId,
      range,
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

function invalidateSheetCache(
  sheetId: string,
  client?: GoogleSheetsClient,
): void {
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

function clearAllSheetCache(): void {
  cache.clear();
}

function getCacheStats(): {
  size: number;
  keys: string[];
  expirations: Array<{ key: string; expiresAt: string; hasRows: boolean }>;
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    expirations: Array.from(cache.entries()).map(([key, v]) => ({
      key,
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

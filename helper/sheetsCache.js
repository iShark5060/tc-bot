const DEFAULT_TTL_MS = Number(process.env.GOOGLE_SHEET_CACHE || 300000);
const cache = new Map();

function keyFor(doc, sheetId) {
  const docId = doc?.spreadsheetId || 'default';
  return `${docId}:${sheetId}`;
}

async function getSheetRowsCached(doc, sheetId, ttlMs) {
  const ttl = Number.isFinite(ttlMs) ? Number(ttlMs) : DEFAULT_TTL_MS;
  const key = keyFor(doc, sheetId);
  const now = Date.now();

  const entry = cache.get(key);

  if (entry?.rows && entry.expiresAt > now) {
    return entry.rows;
  }

  if (entry?.loadingPromise) {
    return entry.loadingPromise;
  }

  const loadingPromise = (async () => {
    try {
      let sheet = doc.sheetsById?.[sheetId];
      if (!sheet) {
        await doc.loadInfo();
        sheet = doc.sheetsById?.[sheetId];
      }
      if (!sheet) throw new Error(`Sheet not found: ${sheetId}`);

      const rows = await sheet.getRows();
      cache.set(key, { rows, expiresAt: Date.now() + ttl });
      return rows;
    } catch (err) {
      cache.delete(key);
      throw err;
    }
  })();

  cache.set(key, { ...(entry || {}), loadingPromise });

  try {
    const rows = await loadingPromise;
    cache.set(key, { rows, expiresAt: Date.now() + ttl });
    return rows;
  } finally {
    const latest = cache.get(key);
    if (latest) {
      delete latest.loadingPromise;
      cache.set(key, latest);
    }
  }
}

function invalidateSheetCache(sheetId, doc) {
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

function clearAllSheetCache() {
  cache.clear();
}

function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    expirations: Array.from(cache.values()).map((v) => ({
      expiresAt: new Date(v.expiresAt).toISOString(),
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

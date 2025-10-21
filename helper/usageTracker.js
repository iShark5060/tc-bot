import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.SQLITE_DB_PATH || './data/metrics.db';
const CHECKPOINT_INTERVAL_MS = Number(
  process.env.CHECKPOINT_INTERVAL_MS || 300000,
);

let db;
let insertStmt;
let checkpointTimer = null;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function initDb() {
  if (db) return;

  ensureDir(DB_PATH);
  db = new Database(DB_PATH, { fileMustExist: false });

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('wal_autocheckpoint = 10');

  db.exec(`
    CREATE TABLE IF NOT EXISTS command_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_name TEXT NOT NULL,
      user_id TEXT,
      guild_id TEXT,
      success INTEGER NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
    );
  `);

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_usage_created_at ON command_usage(created_at);',
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_usage_cmd ON command_usage(command_name);',
  );

  insertStmt = db.prepare(`
    INSERT INTO command_usage
      (command_name, user_id, guild_id, success, error_message)
    VALUES
      (@command_name, @user_id, @guild_id, @success, @error_message)
  `);

  console.log('[USAGE:SQLite] Initialized at', DB_PATH);
}

async function logCommandUsage({
  commandName,
  userId,
  guildId,
  success,
  errorMessage,
}) {
  try {
    initDb();

    insertStmt.run({
      command_name: String(commandName || 'unknown'),
      user_id: userId ? String(userId) : null,
      guild_id: guildId ? String(guildId) : null,
      success: success ? 1 : 0,
      error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
    });
  } catch (err) {
    console.error('[USAGE:SQLite] Failed to log command usage:', err);
  }
}

function checkpoint(mode = 'TRUNCATE') {
  try {
    initDb();
    db.pragma(`wal_checkpoint(${mode})`);
  } catch (e) {
    console.error('[USAGE:SQLite] WAL checkpoint failed:', e);
  }
}

function startWALCheckpoint(intervalMs = 300000) {
  initDb();
  if (checkpointTimer) return;
  checkpointTimer = setInterval(() => {
    checkpoint('TRUNCATE');
  }, intervalMs ?? CHECKPOINT_INTERVAL_MS);
  checkpointTimer.unref?.();
  console.log('[USAGE:SQLite] WAL checkpoint timer started:', intervalMs, 'ms');
}

function stopWALCheckpoint() {
  if (checkpointTimer) {
    clearInterval(checkpointTimer);
    checkpointTimer = null;
    console.log('[USAGE:SQLite] WAL checkpoint timer stopped');
  }
}

function closeDb() {
  if (db) {
    try {
      db.close();
      db = null;
      console.log('[USAGE:SQLite] Database closed');
    } catch (e) {
      console.error('[USAGE:SQLite] Error closing database:', e);
    }
  }
}

export {
  logCommandUsage,
  checkpoint,
  startWALCheckpoint,
  stopWALCheckpoint,
  closeDb,
};

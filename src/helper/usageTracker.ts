import Database, { type Statement } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

import type { CommandUsage, MetricsTotals, MetricsTopCommand } from '../types/index.js';

const DB_PATH = process.env.SQLITE_DB_PATH || './data/metrics.db';
const CHECKPOINT_INTERVAL_MS = Number(
  process.env.CHECKPOINT_INTERVAL_MS || 300000,
);

let db: Database.Database | null = null;
let checkpointTimer: NodeJS.Timeout | null = null;

let insertStmt: Statement | null = null;
let totalsStmt: Statement | null = null;
let topCommandsStmt: Statement | null = null;

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function initDb(): void {
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

  totalsStmt = db.prepare(`
    SELECT
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failure_count,
      COUNT(*) AS total_count
    FROM command_usage
    WHERE created_at >= ?
  `);

  topCommandsStmt = db.prepare(`
    SELECT command_name, COUNT(*) AS cnt
    FROM command_usage
    WHERE created_at >= ?
    GROUP BY command_name
    ORDER BY cnt DESC, command_name ASC
    LIMIT ?
  `);

  console.log('[USAGE:SQLite] Initialized at', DB_PATH);
}

/**
 * Logs a command usage event to the SQLite database.
 * @param commandUsage - Command usage data including name, user, guild, success status, and optional error message
 */
export function logCommandUsage({
  commandName,
  userId,
  guildId,
  success,
  errorMessage,
}: CommandUsage): void {
  try {
    initDb();
    if (!insertStmt) return;

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

/**
 * Gets aggregated metrics totals (success, failure, total counts) since a given UTC timestamp.
 * @param sinceUTC - UTC timestamp string in format 'YYYY-MM-DD HH:MM:SS'
 * @returns MetricsTotals with total_count, success_count, and failure_count
 */
export function getMetricsTotals(sinceUTC: string): MetricsTotals {
  try {
    initDb();
    if (!totalsStmt) return { total_count: 0, success_count: 0, failure_count: 0 };

    const result = totalsStmt.get(sinceUTC) as Partial<MetricsTotals> | undefined;
    return {
      total_count: Number(result?.total_count ?? 0),
      success_count: Number(result?.success_count ?? 0),
      failure_count: Number(result?.failure_count ?? 0),
    };
  } catch (err) {
    console.error('[USAGE:SQLite] Failed to get metrics totals:', err);
    return { total_count: 0, success_count: 0, failure_count: 0 };
  }
}

/**
 * Gets the top N most used commands since a given UTC timestamp.
 * @param sinceUTC - UTC timestamp string in format 'YYYY-MM-DD HH:MM:SS'
 * @param limit - Maximum number of commands to return
 * @returns Array of MetricsTopCommand sorted by usage count (descending)
 */
export function getTopCommands(sinceUTC: string, limit: number): MetricsTopCommand[] {
  try {
    initDb();
    if (!topCommandsStmt) return [];

    return topCommandsStmt.all(sinceUTC, limit) as MetricsTopCommand[];
  } catch (err) {
    console.error('[USAGE:SQLite] Failed to get top commands:', err);
    return [];
  }
}

/**
 * Performs a WAL checkpoint on the SQLite database.
 * @param mode - Checkpoint mode ('TRUNCATE', 'RESTART', or 'PASSIVE')
 */
export function checkpoint(mode = 'TRUNCATE'): void {
  try {
    initDb();
    if (!db) return;
    db.pragma(`wal_checkpoint(${mode})`);
  } catch (e) {
    console.error('[USAGE:SQLite] WAL checkpoint failed:', e);
  }
}

/**
 * Starts a periodic WAL checkpoint timer.
 * @param intervalMs - Interval in milliseconds (default: 300000 = 5 minutes)
 */
export function startWALCheckpoint(intervalMs: number | null = 300000): void {
  initDb();
  if (checkpointTimer) return;
  checkpointTimer = setInterval(() => {
    checkpoint('TRUNCATE');
  }, intervalMs ?? CHECKPOINT_INTERVAL_MS);
  checkpointTimer.unref?.();
  console.log('[USAGE:SQLite] WAL checkpoint timer started:', intervalMs, 'ms');
}

/**
 * Stops the WAL checkpoint timer if running.
 */
export function stopWALCheckpoint(): void {
  if (checkpointTimer) {
    clearInterval(checkpointTimer);
    checkpointTimer = null;
    console.log('[USAGE:SQLite] WAL checkpoint timer stopped');
  }
}

/**
 * Closes the database connection and clears prepared statements.
 * Should be called during graceful shutdown.
 */
export function closeDb(): void {
  if (db) {
    try {
      insertStmt = null;
      totalsStmt = null;
      topCommandsStmt = null;
      db.close();
      db = null;
      console.log('[USAGE:SQLite] Database closed');
    } catch (e) {
      console.error('[USAGE:SQLite] Error closing database:', e);
    }
  }
}

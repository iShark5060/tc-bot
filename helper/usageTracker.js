const { getPool } = require('./db.js');

async function logCommandUsage({
  commandName,
  userId,
  guildId,
  success,
  errorMessage,
}) {
  try {
    const pool = getPool();
    if (!pool) return;

    await pool.execute(
      `INSERT INTO command_usage
      (command_name, user_id, guild_id, success, error_message)
      VALUES (?, ?, ?, ?, ?)`,
      [
      String(commandName || 'unknown'),
      String(userId || 'unknown'),
      guildId ? String(guildId) : null,
      success ? 1 : 0,
      errorMessage ? String(errorMessage).slice(0, 1000) : null,
      ]
    );
  } catch (err) {
    console.error('[USAGE] Failed to log command usage:', err);
  }
}

module.exports = { logCommandUsage };
<?php
if (!defined('TC_BOT_ACCESS')) {
  http_response_code(403);
  die('Direct access not permitted');
}

if (!defined('SQLITE_DB_PATH')) {
  define('SQLITE_DB_PATH', __DIR__ . '/tc-bot/data/metrics.db');
}

define('MAX_RESULTS', 200);
define('CHART_HEIGHT', 300);

$ALLOWED_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

$PERIOD_NAMES = [
  'daily' => 'Daily (24 hours)',
  'weekly' => 'Weekly (7 days)',
  'monthly' => 'Monthly (30 days)',
  'yearly' => 'Yearly (365 days)',
];

define('DEBUG_MODE', getenv('DEBUG_MODE') === 'false' || false);

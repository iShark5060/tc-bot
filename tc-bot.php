<?php
define('TC_BOT_ACCESS', true);

require_once __DIR__ . '/config.inc.php';

$DEBUG = defined('DEBUG_MODE') ? (bool) DEBUG_MODE : false;

$period = isset($_GET['period']) ? strtolower($_GET['period']) : 'daily';
if (!in_array($period, $ALLOWED_PERIODS ?? ['daily','weekly','monthly','yearly'], true)) {
  $period = 'daily';
}

$now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
switch ($period) {
  case 'daily':
    $since = $now->modify('-1 day');
    $groupExpr = "strftime('%H', created_at)";
    $orderGroup = "CAST(strftime('%H', created_at) AS INTEGER) ASC";
    $labelFormatter = function ($r) {
      return str_pad($r['period_label'], 2, '0', STR_PAD_LEFT) . ':00';
    };
    break;
  case 'weekly':
    $since = $now->modify('-7 days');
    $groupExpr = "date(created_at)";
    $orderGroup = "date(created_at) ASC";
    $labelFormatter = fn($r) => $r['period_label'];
    break;
  case 'monthly':
    $since = $now->modify('-1 month');
    $groupExpr = "date(created_at)";
    $orderGroup = "date(created_at) ASC";
    $labelFormatter = fn($r) => $r['period_label'];
    break;
  case 'yearly':
    $since = $now->modify('-1 year');
    $groupExpr = "date(created_at)";
    $orderGroup = "date(created_at) ASC";
    $labelFormatter = fn($r) => $r['period_label'];
    break;
  default:
    $since = $now->modify('-1 day');
    $groupExpr = "strftime('%H', created_at)";
    $orderGroup = "CAST(strftime('%H', created_at) AS INTEGER) ASC";
    $labelFormatter = function ($r) {
      return str_pad($r['period_label'], 2, '0', STR_PAD_LEFT) . ':00';
    };
}
$sinceStr = $since->format('Y-m-d H:i:s');

if (!extension_loaded('pdo_sqlite')) {
  http_response_code(500);
  echo $DEBUG ? 'pdo_sqlite extension not enabled.' : 'DB connection failed.';
  exit;
}

$dbPath = defined('SQLITE_DB_PATH') ? SQLITE_DB_PATH : (__DIR__ . '/../data/metrics.db');
$realPath = @realpath($dbPath) ?: $dbPath;
$uri = 'file:' . str_replace('%2F', '/', rawurlencode($realPath)) . '?mode=ro&immutable=1';
$dsn = 'sqlite:' . $uri;

$options = [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES => false,
];

if (defined('PDO::SQLITE_ATTR_OPEN_FLAGS') && defined('SQLITE3_OPEN_READONLY')) {
  $options[PDO::SQLITE_ATTR_OPEN_FLAGS] = SQLITE3_OPEN_READONLY;
}

try {
  if ($DEBUG) {
    error_log('[TC-Bot][DEBUG] Using SQLite DSN: ' . $dsn);
    error_log('[TC-Bot][DEBUG] DB path: ' . $dbPath);
    error_log('[TC-Bot][DEBUG] Real path: ' . $realPath);
    error_log('[TC-Bot][DEBUG] Exists: ' . (file_exists($realPath) ? 'yes' : 'no') .
              ', Readable: ' . (is_readable($realPath) ? 'yes' : 'no'));
  }

  $pdo = new PDO($dsn, null, null, $options);
  $pdo->exec('PRAGMA query_only=ON;');

} catch (Throwable $e) {
  http_response_code(500);
  if ($DEBUG) {
    echo '<h3>DB connection failed (debug)</h3><pre>' . htmlspecialchars($e->getMessage()) . "</pre>";
    echo '<pre>' . htmlspecialchars(print_r([
      'pdo_sqlite_loaded' => extension_loaded('pdo_sqlite') ? 'yes' : 'no',
      'sqlite3_loaded'    => extension_loaded('sqlite3') ? 'yes' : 'no',
      'db_path'           => $dbPath,
      'realpath'          => $realPath,
      'exists'            => file_exists($realPath) ? 'yes' : 'no',
      'readable'          => is_readable($realPath) ? 'yes' : 'no',
    ], true)) . '</pre>';
  } else {
    echo 'DB connection failed.';
  }
  exit;
}

$maxResults = (int) (defined('MAX_RESULTS') ? MAX_RESULTS : 10);

$topCommandsSql = "
  SELECT command_name, COUNT(*) AS cnt
  FROM command_usage
  WHERE created_at >= :since
  GROUP BY command_name
  ORDER BY cnt DESC, command_name ASC
  LIMIT $maxResults
";

$totalSql = "
  SELECT
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success_count,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failure_count,
    COUNT(*) AS total_count
  FROM command_usage
  WHERE created_at >= :since
";

$byPeriodSql = "
  SELECT
    $groupExpr AS period_label,
    COUNT(*) AS cnt
  FROM command_usage
  WHERE created_at >= :since
  GROUP BY $groupExpr
  ORDER BY $orderGroup
";

try {
  $stmtTop = $pdo->prepare($topCommandsSql);
  $stmtTop->execute([':since' => $sinceStr]);
  $topCommands = $stmtTop->fetchAll();

  $stmtTotal = $pdo->prepare($totalSql);
  $stmtTotal->execute([':since' => $sinceStr]);
  $totals = $stmtTotal->fetch();

  $stmtPeriod = $pdo->prepare($byPeriodSql);
  $stmtPeriod->execute([':since' => $sinceStr]);
  $byPeriod = $stmtPeriod->fetchAll();

} catch (Throwable $e) {
  error_log('[TC-Bot] Query failed: ' . $e->getMessage());
  error_log('[TC-Bot] Period: ' . $period);
  http_response_code(500);
  if ($DEBUG) {
    echo 'Query failed: ' . htmlspecialchars($e->getMessage());
  } else {
    echo 'An error occurred while loading statistics. Please try again later.';
  }
  exit;
}

$labels = array_map($labelFormatter, $byPeriod);
$data = array_map(fn($r) => (int) $r['cnt'], $byPeriod);

function esc($s) {
  return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$successRate = 0;
if (!empty($totals['total_count'])) {
  $successRate = round(
    ($totals['success_count'] / $totals['total_count']) * 100,
    1
  );
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TC-Bot Usage Statistics</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
  :root {
    --bg: #0b0f14;
    --panel: #111827;
    --panel-2: #0f172a;
    --text: #e5e7eb;
    --muted: #9ca3af;
    --border: #1f2937;
    --accent: #0ea5e9;
    --accent-weak: rgba(14, 165, 233, 0.15);
    --success: #22c55e;
    --danger: #ef4444;
    --shadow: 0 8px 24px rgba(0,0,0,0.35);
    --radius: 10px;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    margin: 0;
    padding: 24px;
    color: var(--text);
    background: var(--bg);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
  }
  .container { width: 100%; max-width: 1000px; }
  header {
    display: flex; gap: 16px; flex-wrap: wrap;
    justify-content: space-between; align-items: center;
  }
  h1 { margin: 0; font-size: 1.5rem; letter-spacing: .2px; }
  h2 { margin-top: 24px; font-size: 1.25rem; }
  form { margin: 0; }
  select {
    padding: 8px 12px; font-size: 14px; color: var(--text);
    background: var(--panel); border: 1px solid var(--border);
    border-radius: var(--radius); outline: none; box-shadow: var(--shadow);
    cursor: pointer;
  }
  select:focus { border-color: var(--accent); }
  select:hover { border-color: var(--muted); }
  .cards { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
  .card {
    background: linear-gradient(180deg, var(--panel), var(--panel-2));
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; flex: 1; min-width: 180px; box-shadow: var(--shadow);
  }
  .card-title { color: var(--muted); font-size: 0.875rem; margin-bottom: 4px; }
  .card-value { font-weight: 700; font-size: 1.5rem; }
  .card-subtitle { color: var(--muted); font-size: 0.75rem; margin-top: 4px; }
  .muted { color: var(--muted); }
  table {
    width: 100%; border-collapse: collapse; margin-top: 16px;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow);
  }
  th, td { padding: 10px 12px; text-align: left; }
  thead th {
    background: #0b1220; color: var(--muted);
    font-weight: 600; border-bottom: 1px solid var(--border);
  }
  tbody tr { border-bottom: 1px solid var(--border); }
  tbody tr:hover { background: rgba(255,255,255,0.03); }
  tbody tr:last-child { border-bottom: none; }
  canvas {
    width: 100%; max-width: 100%; height: <?= (int)(defined('CHART_HEIGHT') ? CHART_HEIGHT : 260) ?>px; margin-top: 20px;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow); padding: 8px;
  }
  @media (max-height: 740px) { body { align-items: flex-start; } }
  @media (max-width: 640px) {
    body { padding: 16px; }
    h1 { font-size: 1.25rem; }
    .cards { flex-direction: column; }
    .card { min-width: 100%; }
  }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>TC-Bot Command Usage</h1>
      <form method="get" action="">
        <label for="period" class="muted">Timeframe:</label>
        <select id="period" name="period" onchange="this.form.submit()">
          <?php foreach (($PERIOD_NAMES ?? ['daily' => 'Daily','weekly' => 'Weekly','monthly' => 'Monthly','yearly' => 'Yearly']) as $key => $label): ?>
            <option value="<?= esc($key) ?>" <?= $period === $key ? 'selected' : '' ?>>
              <?= esc($label) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </form>
    </header>

    <div class="cards">
      <div class="card">
        <div class="card-title">Total Commands</div>
        <div class="card-value"><?= number_format((int)($totals['total_count'] ?? 0)) ?></div>
      </div>
      <div class="card">
        <div class="card-title">Successful</div>
        <div class="card-value" style="color: var(--success);">
          <?= number_format((int)($totals['success_count'] ?? 0)) ?>
        </div>
        <div class="card-subtitle"><?= esc($successRate) ?>% success rate</div>
      </div>
      <div class="card">
        <div class="card-title">Failed</div>
        <div class="card-value" style="color: var(--danger);">
          <?= number_format((int)($totals['failure_count'] ?? 0)) ?>
        </div>
      </div>
    </div>

    <canvas id="trend" aria-label="Usage Trend" role="img"></canvas>

    <h2>Top Commands</h2>
    <table aria-label="Top Commands">
      <thead>
        <tr>
          <th>Command</th>
          <th style="text-align: right;">Count</th>
        </tr>
      </thead>
      <tbody>
        <?php if (empty($topCommands)): ?>
          <tr>
            <td colspan="2" class="muted">No data for this period.</td>
          </tr>
        <?php else: ?>
          <?php foreach ($topCommands as $r): ?>
            <tr>
              <td><?= esc($r['command_name']) ?></td>
              <td style="text-align: right;"><?= number_format((int)$r['cnt']) ?></td>
            </tr>
          <?php endforeach; ?>
        <?php endif; ?>
      </tbody>
    </table>
  </div>

  <script>
    const canvas = document.getElementById('trend');
    const labels = <?= json_encode($labels) ?>;
    const series = <?= json_encode($data) ?>;
    const period = <?= json_encode($period) ?>;

    if (labels.length > 0 && canvas) {
      drawChart(canvas, labels, series, period);
    }

    function drawChart(canvas, labels, data, period) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;
      const padding = { top: 40, right: 30, bottom: 60, left: 60 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const lineColor = '#0ea5e9';
      const fillColor = 'rgba(14, 165, 233, 0.15)';
      const gridColor = 'rgba(255, 255, 255, 0.06)';
      const textColor = '#9ca3af';
      const axisColor = '#1f2937';

      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);

      const maxValue = Math.max(...data, 1);
      const yScale = chartHeight / (maxValue * 1.1);
      const xStep = chartWidth / (labels.length - 1 || 1);

      ctx.strokeStyle = gridColor;
      ctx.fillStyle = textColor;
      ctx.font = '12px system-ui, sans-serif';
      ctx.lineWidth = 1;

      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        const value = Math.round(maxValue * 1.1 * (1 - i / gridLines));

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(value.toString(), padding.left - 10, y);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelStep = Math.ceil(labels.length / 12);

      labels.forEach((label, i) => {
        if (i % labelStep === 0 || i === labels.length - 1) {
          const x = padding.left + i * xStep;
          const y = padding.top + chartHeight + 10;

          ctx.beginPath();
          ctx.strokeStyle = axisColor;
          ctx.moveTo(x, padding.top + chartHeight);
          ctx.lineTo(x, padding.top + chartHeight + 5);
          ctx.stroke();

          ctx.fillStyle = textColor;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-0.5);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      });

      ctx.fillStyle = textColor;
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const xAxisTitle = period === 'daily' ? 'Hour (UTC)' : 'Date (UTC)';
      ctx.fillText(xAxisTitle, padding.left + chartWidth / 2, height - 5);

      ctx.save();
      ctx.translate(15, padding.top + chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('Command Count', 0, 0);
      ctx.restore();

      const points = data.map((value, i) => ({
        x: padding.left + i * xStep,
        y: padding.top + chartHeight - value * yScale,
      }));

      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + chartHeight);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      let tooltip = null;
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let nearest = null;
        let minDist = Infinity;
        points.forEach((pt, i) => {
          const dx = mouseX - pt.x;
          const dy = mouseY - pt.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist && dist < 20) {
            minDist = dist;
            nearest = { pt, i, value: data[i], label: labels[i] };
          }
        });

        if (nearest) {
          canvas.style.cursor = 'pointer';
          showTooltip(nearest, mouseX, mouseY);
        } else {
          canvas.style.cursor = 'default';
          hideTooltip();
        }
      });
      canvas.addEventListener('mouseleave', hideTooltip);

      function showTooltip(data, x, y) {
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: fixed;
            background: #0b1220;
            color: #e5e7eb;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #1f2937;
            font-size: 13px;
            pointer-events: none;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          `;
          document.body.appendChild(tooltip);
        }
        const timeLabel = period === 'daily' ? data.label + ' UTC' : data.label;
        tooltip.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px;">${timeLabel}</div>
          <div>Commands: ${data.value}</div>
        `;
        const rect = canvas.getBoundingClientRect();
        tooltip.style.left = rect.left + x + 10 + 'px';
        tooltip.style.top = rect.top + y - 40 + 'px';
        tooltip.style.display = 'block';
      }

      function hideTooltip() {
        if (tooltip) tooltip.style.display = 'none';
      }
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const canvas = document.getElementById('trend');
        if (canvas && labels.length > 0) {
          drawChart(canvas, labels, series, period);
        }
      }, 250);
    });
  </script>
</body>
</html>
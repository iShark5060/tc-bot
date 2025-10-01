<?php
define('TC_BOT_ACCESS', true);

require_once __DIR__ . '/config.inc.php';

$period = isset($_GET['period']) ? strtolower($_GET['period']) : 'daily';
if (!in_array($period, $ALLOWED_PERIODS, true)) {
  $period = 'daily';
}

$dsn = sprintf(
  'mysql:host=%s;port=%d;dbname=%s;charset=%s',
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_CHARSET
);

$options = [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES => false,
];

try {
  $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (Throwable $e) {
  http_response_code(500);
  echo 'DB connection failed.';
  exit;
}

switch ($period) {
  case 'daily':
    $interval = '1 DAY';
    $groupBy = 'HOUR(created_at)';
    $dateFormat = '%H:00';
    break;
  case 'weekly':
    $interval = '7 DAY';
    $groupBy = 'DATE(created_at)';
    $dateFormat = '%Y-%m-%d';
    break;
  case 'monthly':
    $interval = '1 MONTH';
    $groupBy = 'DATE(created_at)';
    $dateFormat = '%Y-%m-%d';
    break;
  case 'yearly':
    $interval = '1 YEAR';
    $groupBy = 'DATE(created_at)';
    $dateFormat = '%Y-%m-%d';
    break;
  default:
    $interval = '1 DAY';
    $groupBy = 'HOUR(created_at)';
    $dateFormat = '%H:00';
}

$topCommandsQuery = "
  SELECT command_name, COUNT(*) AS cnt
  FROM command_usage
  WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL $interval)
  GROUP BY command_name
  ORDER BY cnt DESC, command_name ASC
  LIMIT " . MAX_RESULTS;

$totalQuery = "
  SELECT
    SUM(success = 1) AS success_count,
    SUM(success = 0) AS failure_count,
    COUNT(*) AS total_count
  FROM command_usage
  WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL $interval)
";

if ($period === 'daily') {
  $byPeriodQuery = "
    SELECT
      HOUR(created_at) AS period_label,
      COUNT(*) AS cnt
    FROM command_usage
    WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL $interval)
    GROUP BY HOUR(created_at)
    ORDER BY HOUR(created_at) ASC
  ";
} else {
  $byPeriodQuery = "
    SELECT
      DATE(created_at) AS period_label,
      COUNT(*) AS cnt
    FROM command_usage
    WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL $interval)
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  ";
}

try {
  $topCommands = $pdo->query($topCommandsQuery)->fetchAll();
  $totals = $pdo->query($totalQuery)->fetch();
  $byPeriod = $pdo->query($byPeriodQuery)->fetchAll();
} catch (Throwable $e) {
  error_log('[TC-Bot] Query failed: ' . $e->getMessage());
  error_log('[TC-Bot] Period: ' . $period);
  error_log('[TC-Bot] Query: ' . $byPeriodQuery);

  http_response_code(500);

  if (DEBUG_MODE) {
    echo 'Query failed: ' . htmlspecialchars($e->getMessage());
    echo '<pre>' . htmlspecialchars($byPeriodQuery) . '</pre>';
  } else {
    echo 'An error occurred while loading statistics. Please try again later.';
  }
  exit;
}

if ($period === 'daily') {
  $labels = array_map(function($r) {
    return str_pad($r['period_label'], 2, '0', STR_PAD_LEFT) . ':00';
  }, $byPeriod);
} else {
  $labels = array_map(fn($r) => $r['period_label'], $byPeriod);
}
$data = array_map(fn($r) => intval($r['cnt']), $byPeriod);

$labels = array_map(fn($r) => $r['period_label'], $byPeriod);
$data = array_map(fn($r) => intval($r['cnt']), $byPeriod);

function esc($s) {
  return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$successRate = 0;
if (isset($totals['total_count']) && $totals['total_count'] > 0) {
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
  .container {
    width: 100%;
    max-width: 1000px;
  }
  header {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    letter-spacing: .2px;
  }
  h2 {
    margin-top: 24px;
    font-size: 1.25rem;
  }
  form { margin: 0; }
  select {
    padding: 8px 12px;
    font-size: 14px;
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    outline: none;
    box-shadow: var(--shadow);
    cursor: pointer;
  }
  select:focus { border-color: var(--accent); }
  select:hover { border-color: var(--muted); }
  .cards {
    display: flex;
    gap: 16px;
    margin-top: 16px;
    flex-wrap: wrap;
  }
  .card {
    background: linear-gradient(180deg, var(--panel), var(--panel-2));
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    flex: 1;
    min-width: 180px;
    box-shadow: var(--shadow);
  }
  .card-title {
    color: var(--muted);
    font-size: 0.875rem;
    margin-bottom: 4px;
  }
  .card-value {
    font-weight: 700;
    font-size: 1.5rem;
  }
  .card-subtitle {
    color: var(--muted);
    font-size: 0.75rem;
    margin-top: 4px;
  }
  .muted { color: var(--muted); }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  th, td {
    padding: 10px 12px;
    text-align: left;
  }
  thead th {
    background: #0b1220;
    color: var(--muted);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }
  tbody tr {
    border-bottom: 1px solid var(--border);
  }
  tbody tr:hover {
    background: rgba(255,255,255,0.03);
  }
  tbody tr:last-child {
    border-bottom: none;
  }
  canvas {
    width: 100%;
    max-width: 100%;
    height: <?= CHART_HEIGHT ?>px;
    margin-top: 20px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 8px;
  }

  @media (max-height: 740px) {
    body { align-items: flex-start; }
  }

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
          <?php foreach ($PERIOD_NAMES as $key => $label): ?>
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
        <div class="card-value"><?= number_format($totals['total_count'] ?? 0) ?></div>
      </div>
      <div class="card">
        <div class="card-title">Successful</div>
        <div class="card-value" style="color: var(--success);">
          <?= number_format($totals['success_count'] ?? 0) ?>
        </div>
        <div class="card-subtitle"><?= $successRate ?>% success rate</div>
      </div>
      <div class="card">
        <div class="card-title">Failed</div>
        <div class="card-value" style="color: var(--danger);">
          <?= number_format($totals['failure_count'] ?? 0) ?>
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
              <td style="text-align: right;"><?= number_format($r['cnt']) ?></td>
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
      const minValue = Math.min(...data, 0);
      const valueRange = maxValue - minValue || 1;
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
          const x = padding.left + (i * xStep);
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
        x: padding.left + (i * xStep),
        y: padding.top + chartHeight - (value * yScale)
      }));

      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + chartHeight);
      points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
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

        points.forEach((point, i) => {
          const dist = Math.sqrt(
            Math.pow(mouseX - point.x, 2) +
            Math.pow(mouseY - point.y, 2)
          );
          if (dist < minDist && dist < 20) {
            minDist = dist;
            nearest = { point, i, value: data[i], label: labels[i] };
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
        const tooltipX = rect.left + x + 10;
        const tooltipY = rect.top + y - 40;

        tooltip.style.left = tooltipX + 'px';
        tooltip.style.top = tooltipY + 'px';
        tooltip.style.display = 'block';
      }

      function hideTooltip() {
        if (tooltip) {
          tooltip.style.display = 'none';
        }
      }
    }

    // Redraw on window resize
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
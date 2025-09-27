<?php

$host = getenv('MYSQL_HOST') ?: 'localhost';
$port = intval(getenv('MYSQL_PORT') ?: '3306');
$user = getenv('MYSQL_USER') ?: 'mysql_user';
$pass = getenv('MYSQL_PASSWORD') ?: 'mysql_password';
$db   = getenv('MYSQL_NAME') ?: 'mysql_database';

$period = isset($_GET['period']) ? strtolower($_GET['period']) : 'daily';
$allowed = ['daily', 'weekly', 'monthly', 'yearly'];
if (!in_array($period, $allowed, true)) {
	$period = 'daily';
}

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
$options = [
	PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
	PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
	PDO::ATTR_EMULATE_PREPARES => false,
];

try {
	$pdo = new PDO($dsn, $user, $pass, $options);
} catch (Throwable $e) {
	http_response_code(500);
	echo 'DB connection failed.';
	exit;
}

// Compute window start
switch ($period) {
	case 'daily':
		$interval = '1 DAY';
	break;
	case 'weekly':
		$interval = '7 DAY';
	break;
	case 'monthly':
		$interval = '1 MONTH';
	break;
	case 'yearly':
		$interval = '1 YEAR';
	break;
	default:
		$interval = '1 DAY';
}

$query = "
	SELECT command_name, COUNT(*) AS cnt
	FROM command_usage
	WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL $interval)
	GROUP BY command_name
	ORDER BY cnt DESC, command_name ASC
	LIMIT 200
";

$totalQuery = "
	SELECT
		SUM(success = 1) AS success_count,
		SUM(success = 0) AS failure_count,
		COUNT(*) AS total_count
	FROM command_usage
	WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL $interval)
";

$byDayQuery = "
	SELECT DATE(created_at) AS day, COUNT(*) AS cnt
	FROM command_usage
	WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL $interval)
	GROUP BY day
	ORDER BY day ASC
";

try {
	$stmt = $pdo->query($query);
	$rows = $stmt->fetchAll();

	$totals = $pdo->query($totalQuery)->fetch();

	$byDay = $pdo->query($byDayQuery)->fetchAll();
} catch (Throwable $e) {
	http_response_code(500);
	echo 'Query failed.';
	exit;
}

// Prepare chart data
$labels = array_map(fn($r) => $r['day'], $byDay);
$data = array_map(fn($r) => intval($r['cnt']), $byDay);

function esc($s) {
	return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<title>TC-Bot Usage</title>
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
	@media (prefers-color-scheme: dark) {
		:root {
		/* already dark */
		}
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
	header { display: flex; gap: 16px; flex-wrap: wrap; justify-content: space-between; align-items: center; }
	h1 { margin: 0; font-size: 1.5rem; letter-spacing: .2px; }
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
	}
	select:focus { border-color: var(--accent); }
	.cards { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
	.card {
		background: linear-gradient(180deg, var(--panel), var(--panel-2));
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 14px 16px;
		flex: 1;
		min-width: 180px;
		box-shadow: var(--shadow);
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
	th, td { padding: 10px 12px; text-align: left; }
	thead th {
		background: #0b1220;
		color: var(--muted);
		font-weight: 600;
		border-bottom: 1px solid var(--border);
	}
	tbody tr { border-bottom: 1px solid var(--border); }
	tbody tr:hover { background: rgba(255,255,255,0.03); }
	canvas { width: 100%; max-width: 100%; height: 300px; margin-top: 20px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 8px; }
	a, a:visited { color: var(--accent); text-decoration: none; }

	/* If the viewport height is small, avoid awkward centering */
	@media (max-height: 740px) {
		body { align-items: flex-start; }
	}
	</style>
	<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
	<div class="container">
		<header>
			<h1>TC-Bot Command Usage</h1>
			<form method="get" action="">
			<label for="period" class="muted">Timeframe:</label>
			<select id="period" name="period" onchange="this.form.submit()">
				<option value="daily"  <?= $period==='daily'  ? 'selected' : '' ?>>Daily</option>
				<option value="weekly" <?= $period==='weekly' ? 'selected' : '' ?>>Weekly</option>
				<option value="monthly"<?= $period==='monthly'? 'selected' : '' ?>>Monthly</option>
				<option value="yearly" <?= $period==='yearly' ? 'selected' : '' ?>>Yearly</option>
			</select>
			</form>
		</header>

		<div class="cards">
			<div class="card">
				<div class="muted">Total</div>
				<div style="font-weight:700;font-size:1.25rem;"><?= intval($totals['total_count'] ?? 0) ?></div>
			</div>
			<div class="card">
				<div class="muted">Success</div>
				<div style="font-weight:700;font-size:1.25rem;"><?= intval($totals['success_count'] ?? 0) ?></div>
			</div>
			<div class="card">
				<div class="muted">Failures</div>
				<div style="font-weight:700;font-size:1.25rem;"><?= intval($totals['failure_count'] ?? 0) ?></div>
			</div>
		</div>

		<canvas id="trend" aria-label="Usage Trend" role="img"></canvas>

		<h2 style="margin-top:24px;">Top Commands</h2>
		<table aria-label="Top Commands">
			<thead>
				<tr>
				<th>Command</th>
				<th>Count</th>
				</tr>
			</thead>
			<tbody>
				<?php if (empty($rows)): ?>
				<tr><td colspan="2" class="muted">No data for this period.</td></tr>
				<?php else: ?>
				<?php foreach ($rows as $r): ?>
					<tr>
					<td><?= esc($r['command_name']) ?></td>
					<td><?= intval($r['cnt']) ?></td>
					</tr>
				<?php endforeach; ?>
				<?php endif; ?>
			</tbody>
		</table>
	</div>
	<script>
		const ctx = document.getElementById('trend');
		const labels = <?= json_encode($labels) ?>;
		const series = <?= json_encode($data) ?>;
		if (labels.length > 0) {
			new Chart(ctx, {
				type: 'line',
				data: {
					labels,
					datasets: [{
						label: 'Commands',
						data: series,
						borderColor: '#0ea5e9',
						backgroundColor: 'rgba(14,165,233,0.15)',
						tension: 0.25,
						fill: true,
					}],
				},
				options: {
				responsive: true,
				color: '#e5e7eb',
				scales: {
					x: {
						ticks: { color: '#9ca3af' },
						grid: { color: 'rgba(255,255,255,0.06)' },
						title: { display: true, text: 'Date (UTC)', color: '#9ca3af' }
					},
					y: {
						beginAtZero: true,
						ticks: { color: '#9ca3af' },
						grid: { color: 'rgba(255,255,255,0.06)' },
						title: { display: true, text: 'Count', color: '#9ca3af' }
					},
				},
				plugins: {
					legend: { display: false, labels: { color: '#e5e7eb' } },
					tooltip: {
						mode: 'index',
						intersect: false,
						backgroundColor: '#0b1220',
						titleColor: '#e5e7eb',
						bodyColor: '#e5e7eb',
						borderColor: '#1f2937',
						borderWidth: 1,
					},
				},
				},
			});
		}
	</script>
</body>
</html>
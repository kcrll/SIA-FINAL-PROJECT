<?php
require __DIR__ . '/../config.php';
require_admin();

$today = date('Y-m-d');

$farmers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn();
$plots   = (int)$pdo->query('SELECT COUNT(*) FROM plots')->fetchColumn();
$harvest = (float)$pdo->query('SELECT COALESCE(SUM(quantity), 0) FROM harvests')->fetchColumn();

$s = $pdo->prepare(
    'SELECT COALESCE(SUM(done = 0), 0) AS pending, COALESCE(SUM(done = 0 AND task_date < ?), 0) AS overdue
     FROM watering_tasks'
);
$s->execute([$today]);
$tasks = $s->fetch();

$logs = $pdo->query(
    'SELECT id, username, action, details, created_at FROM activity_logs ORDER BY id DESC LIMIT 8'
)->fetchAll();

json_ok([
    'stats' => [
        'farmers' => $farmers,
        'plots'   => $plots,
        'pending' => (int)$tasks['pending'],
        'overdue' => (int)$tasks['overdue'],
        'harvest' => $harvest,
    ],
    'logs' => $logs,
]);

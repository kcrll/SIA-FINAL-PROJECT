<?php
require __DIR__ . '/../config.php';
require_admin();

if ((input()['action'] ?? '') === 'clear') {
    $pdo->exec('DELETE FROM activity_logs');
    log_activity($pdo, 'Clear Logs', 'Cleared all activity logs');
    json_ok(['message' => 'Activity logs cleared.']);
}

$logs = $pdo->query(
    'SELECT id, username, action, details, ip_address, created_at
     FROM activity_logs ORDER BY id DESC LIMIT 100'
)->fetchAll();

json_ok(['logs' => $logs]);

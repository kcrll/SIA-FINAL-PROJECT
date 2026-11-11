<?php
require __DIR__ . '/../config.php';
require_admin();

$users = $pdo->query(
    "SELECT
        COUNT(*) AS total_users,
        SUM(status='active') AS active_users,
        SUM(status='pending') AS pending_users
     FROM users
     WHERE role='user'"
)->fetch();

$plots = $pdo->query(
    "SELECT COUNT(*) AS total_plots FROM plots WHERE crop_type='Rice'"
)->fetch();

json_ok(['overview' => ['users' => $users, 'plots' => $plots]]);

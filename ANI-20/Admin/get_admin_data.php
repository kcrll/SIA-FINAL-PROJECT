<?php
require __DIR__ . '/../config.php';
require_admin();

$users = $pdo->query(
    "SELECT
        COUNT(*) AS total_users,
        SUM(status='active') AS active_users
     FROM users
     WHERE role='user'"
)->fetch();

$plots = $pdo->query(
    "SELECT COUNT(*) AS total_plots FROM plots"
)->fetch();

json_ok(['overview' => ['users' => $users, 'plots' => $plots]]);

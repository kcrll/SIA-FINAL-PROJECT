<?php
require __DIR__ . '/../config.php';

$d = input();
$name   = required($d, 'name');
$status = (string)($d['status'] ?? 'Available');

if (mb_strlen($name) > 100) json_error('Plot name is too long.');
if (!in_array($status, ['Available', 'Planted', 'Maintenance'], true)) json_error('Invalid plot status.');

// Admins may create a plot for any farmer; everyone else owns what they create.
$owner = uid();
if (is_admin() && !empty($d['user_id'])) {
    $chk = $pdo->prepare('SELECT COUNT(*) FROM users WHERE id = ?');
    $chk->execute([(int)$d['user_id']]);
    if (!(int)$chk->fetchColumn()) json_error('Owner not found.');
    $owner = (int)$d['user_id'];
}

try {
    $s = $pdo->prepare('INSERT INTO plots (user_id, name, status) VALUES (?, ?, ?)');
    $s->execute([$owner, $name, $status]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') json_error('That owner already has a plot with this name.');
    throw $e;
}

log_activity($pdo, 'Add Plot', "Added plot '$name'");
json_ok(['id' => (int)$pdo->lastInsertId(), 'message' => 'Plot added.']);

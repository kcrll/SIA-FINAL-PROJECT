<?php
require __DIR__ . '/../config.php';

$d = input();
$id     = (int)($d['id'] ?? 0);
$name   = required($d, 'name');
$status = required($d, 'status');

if (mb_strlen($name) > 100) json_error('Plot name is too long.');
if (!in_array($status, ['Available', 'Planted', 'Maintenance'], true)) json_error('Invalid plot status.');
if (!$id || !own_plot($pdo, $id)) json_error('Plot not found.', 404);

try {
    $s = $pdo->prepare('UPDATE plots SET name = ?, status = ? WHERE id = ?');
    $s->execute([$name, $status, $id]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') json_error('That owner already has a plot with this name.');
    throw $e;
}

json_ok(['message' => 'Plot updated.']);

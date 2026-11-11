<?php
require __DIR__ . '/../config.php';

$id = (int)(input()['id'] ?? 0);
if (!$id) json_error('Invalid item.');

$s = $pdo->prepare('SELECT item_name FROM inventory_items WHERE id = ? AND user_id <=> COALESCE(?, user_id)');
$s->execute([$id, sid()]);
$item = $s->fetch();
if (!$item) json_error('Inventory item not found.', 404);

$pdo->prepare('DELETE FROM inventory_items WHERE id = ?')->execute([$id]);

log_activity($pdo, 'Delete Inventory Item', 'Deleted ' . $item['item_name']);
json_ok(['message' => 'Item deleted.']);

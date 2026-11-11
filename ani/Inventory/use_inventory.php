<?php
require __DIR__ . '/../config.php';

$d = input();
$itemId  = (int)($d['item_id'] ?? 0);
$used    = (float)($d['quantity_used'] ?? 0);
$date    = date_field($d, 'used_date');
$plotId  = (int)($d['plot_id'] ?? 0) ?: null;   // empty means the whole farm
$purpose = trim((string)($d['purpose'] ?? ''));

if (!$itemId || $used <= 0) json_error('Choose an item and enter a quantity greater than zero.');
if ($plotId !== null && !own_plot($pdo, $plotId)) json_error('Plot not found.', 404);

$pdo->beginTransaction();

// Lock the row so two simultaneous requests cannot overdraw the stock.
$s = $pdo->prepare(
    'SELECT item_name, quantity, unit FROM inventory_items
     WHERE id = ? AND user_id <=> COALESCE(?, user_id) FOR UPDATE'
);
$s->execute([$itemId, sid()]);
$item = $s->fetch();

if (!$item) {
    $pdo->rollBack();
    json_error('Inventory item not found.', 404);
}
if ($used > (float)$item['quantity']) {
    $pdo->rollBack();
    json_error("Only {$item['quantity']} {$item['unit']} left in stock.");
}

$remaining = round((float)$item['quantity'] - $used, 2);

$pdo->prepare('UPDATE inventory_items SET quantity = ? WHERE id = ?')->execute([$remaining, $itemId]);
$pdo->prepare(
    'INSERT INTO inventory_usage_logs (item_id, quantity_used, used_date, plot_id, purpose, logged_by)
     VALUES (?, ?, ?, ?, ?, ?)'
)->execute([$itemId, $used, $date, $plotId, $purpose ?: 'Field application', $_SESSION['username']]);

$pdo->commit();

log_activity($pdo, 'Use Inventory Stock', "Used $used {$item['unit']} of {$item['item_name']} (left: $remaining)");
json_ok(['message' => "Recorded. {$remaining} {$item['unit']} of {$item['item_name']} left."]);

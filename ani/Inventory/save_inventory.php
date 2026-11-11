<?php
require __DIR__ . '/../config.php';

// Creates an item, or updates it when an id is sent.
$d = input();
$id        = (int)($d['id'] ?? 0);
$name      = required($d, 'item_name');
$category  = required($d, 'category');
$unit      = trim((string)($d['unit'] ?? '')) ?: 'kg';
$quantity  = (float)($d['quantity'] ?? 0);
$threshold = (float)($d['threshold'] ?? 0);
$purchased = date_field($d, 'purchase_date');
$cost      = ($d['cost'] ?? '') === '' ? null : (float)$d['cost'];
$notes     = trim((string)($d['notes'] ?? ''));

if (!in_array($category, ['Rice Seeds', 'Fertilizers', 'Pesticides', 'Other Supplies'], true)) {
    json_error('Select a valid category.');
}
if (!in_array($unit, ['kg', 'bags', 'liters', 'bottles', 'grams', 'pcs', 'packs'], true)) {
    json_error('Select a valid unit.');
}
if ($quantity < 0 || $threshold < 0 || ($cost !== null && $cost < 0)) {
    json_error('Quantity, alert level and cost cannot be negative.');
}
if (mb_strlen($name) > 150) json_error('Item name is too long.');

$values = [$name, $category, $quantity, $unit, $purchased, $threshold, $cost, $notes ?: null];

if ($id) {
    $chk = $pdo->prepare('SELECT COUNT(*) FROM inventory_items WHERE id = ? AND user_id <=> COALESCE(?, user_id)');
    $chk->execute([$id, sid()]);
    if (!(int)$chk->fetchColumn()) json_error('Inventory item not found.', 404);

    $pdo->prepare(
        'UPDATE inventory_items
         SET item_name = ?, category = ?, quantity = ?, unit = ?, purchase_date = ?, threshold = ?, cost = ?, notes = ?
         WHERE id = ?'
    )->execute([...$values, $id]);

    log_activity($pdo, 'Update Inventory Item', "Updated $name (stock: $quantity $unit)");
    json_ok(['message' => 'Item updated.']);
}

$pdo->prepare(
    'INSERT INTO inventory_items
        (item_name, category, quantity, unit, purchase_date, threshold, cost, notes, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
)->execute([...$values, uid()]);

log_activity($pdo, 'Add Inventory Item', "Added $name ($category: $quantity $unit)");
json_ok(['message' => 'Item added to inventory.']);

<?php
require __DIR__ . '/../config.php';

$d = input();

$itemName = required($d, 'item_name');
$category = required($d, 'category');
$quantity = (float)($d['quantity'] ?? 0);
$unit = trim((string)($d['unit'] ?? 'kg'));
$purchaseDate = required($d, 'purchase_date');
$threshold = (float)($d['threshold'] ?? 0);
$notes = trim((string)($d['notes'] ?? ''));

$allowedCategories = ['Rice Seeds', 'Fertilizers', 'Pesticides', 'Other Supplies'];
if (!in_array($category, $allowedCategories, true)) {
    json_error('Select a valid inventory category.');
}

if ($quantity < 0) {
    json_error('Quantity cannot be negative.');
}

if ($threshold < 0) {
    json_error('Threshold cannot be negative.');
}

$stmt = $pdo->prepare(
    "INSERT INTO inventory_items
        (user_id, item_name, category, quantity, unit, purchase_date, threshold, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

$stmt->execute([
    uid(),
    $itemName,
    $category,
    $quantity,
    $unit ?: 'kg',
    $purchaseDate,
    $threshold,
    $notes ?: null
]);

$newId = (int)$pdo->lastInsertId();

$user = $_SESSION['username'] ?? 'User';
log_activity($pdo, $_SESSION['user_id'] ?? null, $user, 'Add Inventory Item', "Added $itemName ($category: $quantity $unit)");

json_ok([
    'id' => $newId,
    'message' => 'Inventory item added successfully.'
]);

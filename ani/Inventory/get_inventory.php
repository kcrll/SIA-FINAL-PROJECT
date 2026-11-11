<?php
require __DIR__ . '/../config.php';

$s = $pdo->prepare(
    'SELECT id, item_name, category, quantity, unit, purchase_date, threshold, cost, notes
     FROM inventory_items
     WHERE user_id <=> COALESCE(?, user_id)
     ORDER BY category, item_name'
);
$s->execute([sid()]);
$items = $s->fetchAll();

$s = $pdo->prepare(
    "SELECT u.id, u.quantity_used, u.used_date, u.purpose, u.logged_by,
            i.item_name, i.category, i.unit,
            COALESCE(p.name, 'Whole farm') AS plot_name
     FROM inventory_usage_logs u
     JOIN inventory_items i ON i.id = u.item_id
     LEFT JOIN plots p ON p.id = u.plot_id
     WHERE i.user_id <=> COALESCE(?, i.user_id)
     ORDER BY u.used_date DESC, u.id DESC
     LIMIT 20"
);
$s->execute([sid()]);

json_ok(['items' => $items, 'recent_usage' => $s->fetchAll()]);

<?php
require __DIR__ . '/../config.php';

$today = date('Y-m-d');
$weekEnd = date('Y-m-d', strtotime('+6 days'));
$uid = sid();

// Count of one value, scoped to the logged-in user (admins see everything)
function scalar(PDO $pdo, string $sql, array $params): int {
    $s = $pdo->prepare($sql);
    $s->execute($params);
    return (int)$s->fetchColumn();
}

$stats = [
    'rice' => scalar(
        $pdo,
        "SELECT COUNT(*) FROM plots
         WHERE crop_type='Rice' AND user_id <=> COALESCE(?, user_id)",
        [$uid]
    ),
    'tasks_pending' => scalar(
        $pdo,
        "SELECT COUNT(*) FROM watering_tasks w
         JOIN plots p ON p.id=w.plot_id
         WHERE w.done=0 AND p.crop_type='Rice'
           AND p.user_id <=> COALESCE(?, p.user_id)",
        [$uid]
    ),
    'harvests_week' => scalar(
        $pdo,
        "SELECT COUNT(*) FROM harvests h
         JOIN plots p ON p.id=h.plot_id
         WHERE h.harvest_date BETWEEN ? AND ?
           AND p.crop_type='Rice'
           AND p.user_id <=> COALESCE(?, p.user_id)",
        [$today, $weekEnd, $uid]
    ),
];

// Plots with their latest planting (same fields as Plots/get_plots.php)
$s = $pdo->prepare(
    "SELECT
        p.*,
        pl.id AS planting_id,
        pl.crop_name,
        pl.variety,
        pl.planted_date,
        pl.expected_harvest_date,
        pl.notes AS planting_notes
     FROM plots p
     LEFT JOIN plantings pl
        ON pl.id=(SELECT MAX(id) FROM plantings WHERE plot_id=p.id)
     WHERE p.crop_type='Rice'
       AND p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY p.id"
);
$s->execute([$uid]);
$plots = $s->fetchAll();

// Every task, pending first, then by date
$s = $pdo->prepare(
    "SELECT
        w.*,
        p.name AS plot_name,
        p.crop_type,
        pl.crop_name
     FROM watering_tasks w
     JOIN plots p ON p.id=w.plot_id
     LEFT JOIN plantings pl
        ON pl.id=(SELECT MAX(id) FROM plantings WHERE plot_id=p.id)
     WHERE p.crop_type='Rice'
       AND p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY w.done, w.task_date, w.id"
);
$s->execute([$uid]);
$tasks = $s->fetchAll();

$s = $pdo->prepare(
    "SELECT h.*, p.name AS plot_name, p.crop_type
     FROM harvests h
     JOIN plots p ON p.id=h.plot_id
     WHERE p.crop_type='Rice'
       AND p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY h.harvest_date DESC, h.id DESC
     LIMIT 5"
);
$s->execute([$uid]);
$harvests = $s->fetchAll();

// Seeds come from inventory_items, the table the Inventory page edits
$s = $pdo->prepare(
    "SELECT id, item_name AS seed_name, quantity, unit, threshold
     FROM inventory_items
     WHERE category='Rice Seeds'
       AND user_id <=> COALESCE(?, user_id)
     ORDER BY item_name"
);
$s->execute([$uid]);
$seeds = $s->fetchAll();

foreach ($seeds as &$x) {
    $x['quantity'] = (float)$x['quantity'];
    $x['low_stock'] = $x['quantity'] <= (float)$x['threshold'];
}
unset($x);

json_ok([
    'stats' => $stats,
    'plots' => $plots,
    'tasks' => $tasks,
    'harvests' => $harvests,
    'seeds' => $seeds
]);

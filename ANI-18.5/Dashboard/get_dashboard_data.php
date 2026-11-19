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
         WHERE user_id <=> COALESCE(?, user_id)",
        [$uid]
    ),
    'tasks_pending' => scalar(
        $pdo,
        "SELECT COUNT(*) FROM tasks t
         JOIN plots p ON p.id=t.plot_id
         WHERE t.done=0
           AND p.user_id <=> COALESCE(?, p.user_id)",
        [$uid]
    ),
    'harvests_week' => scalar(
        $pdo,
        "SELECT COUNT(*) FROM harvests h
         JOIN plots p ON p.id=h.plot_id
         WHERE h.harvest_date BETWEEN ? AND ?
           AND p.user_id <=> COALESCE(?, p.user_id)",
        [$today, $weekEnd, $uid]
    ),
];

// Plots with their latest planting (same fields as Plots/get_plots.php)
$s = $pdo->prepare(
    "SELECT
        p.*,
        pl.id AS planting_id,
        pl.variety,
        pl.planted_date,
        pl.expected_harvest_date,
        pl.notes AS planting_notes
     FROM plots p
     LEFT JOIN plantings pl
        ON pl.id=(SELECT MAX(id) FROM plantings WHERE plot_id=p.id)
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY p.id"
);
$s->execute([$uid]);
$plots = $s->fetchAll();

// Every task, pending first, then by date
$s = $pdo->prepare(
    "SELECT
        t.*,
        p.name AS plot_name
     FROM tasks t
     JOIN plots p ON p.id=t.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY t.done, t.task_date, t.id"
);
$s->execute([$uid]);
$tasks = $s->fetchAll();

$s = $pdo->prepare(
    "SELECT h.*, p.name AS plot_name
     FROM harvests h
     JOIN plots p ON p.id=h.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)
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

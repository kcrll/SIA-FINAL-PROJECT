<?php
require __DIR__ . '/../config.php';

$today   = date('Y-m-d');
$weekAgo = date('Y-m-d', strtotime('-6 days'));
$owner   = sid();

$one = function (string $sql, array $params) use ($pdo) {
    $s = $pdo->prepare($sql);
    $s->execute($params);
    return $s->fetch();
};

$plots = $one('SELECT COUNT(*) AS total, COALESCE(SUM(status = ?), 0) AS planted
               FROM plots WHERE user_id <=> COALESCE(?, user_id)', ['Planted', $owner]);

$tasks = $one(
    'SELECT COALESCE(SUM(t.done = 0), 0) AS pending,
            COALESCE(SUM(t.done = 0 AND t.task_date < ?), 0) AS overdue,
            COALESCE(SUM(t.done = 0 AND t.task_date = ?), 0) AS due_today
     FROM watering_tasks t JOIN plots p ON p.id = t.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)',
    [$today, $today, $owner]
);

$harvest = $one(
    'SELECT COALESCE(SUM(h.quantity), 0) AS kg
     FROM harvests h JOIN plots p ON p.id = h.plot_id
     WHERE h.harvest_date BETWEEN ? AND ? AND p.user_id <=> COALESCE(?, p.user_id)',
    [$weekAgo, $today, $owner]
);

$low = $one(
    'SELECT COUNT(*) AS n FROM inventory_items
     WHERE quantity <= threshold AND user_id <=> COALESCE(?, user_id)',
    [$owner]
);

// Every task, pending first, so the dashboard is not limited to today.
$s = $pdo->prepare(
    'SELECT t.id, t.task_type, t.task_date, t.done, p.name AS plot_name
     FROM watering_tasks t JOIN plots p ON p.id = t.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY t.done, t.task_date, t.id'
);
$s->execute([$owner]);
$taskList = $s->fetchAll();

$s = $pdo->prepare(
    'SELECT h.id, h.harvest_date, h.quantity, p.name AS plot_name
     FROM harvests h JOIN plots p ON p.id = h.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY h.harvest_date DESC, h.id DESC
     LIMIT 5'
);
$s->execute([$owner]);
$harvests = $s->fetchAll();

$s = $pdo->prepare(
    "SELECT id, item_name, quantity, unit, threshold
     FROM inventory_items
     WHERE category = 'Rice Seeds' AND user_id <=> COALESCE(?, user_id)
     ORDER BY item_name"
);
$s->execute([$owner]);
$seeds = $s->fetchAll();

json_ok([
    'stats' => [
        'plots'        => (int)$plots['total'],
        'planted'      => (int)$plots['planted'],
        'pending'      => (int)$tasks['pending'],
        'overdue'      => (int)$tasks['overdue'],
        'due_today'    => (int)$tasks['due_today'],
        'harvest_week' => (float)$harvest['kg'],
        'low_stock'    => (int)$low['n'],
    ],
    'tasks'    => $taskList,
    'harvests' => $harvests,
    'seeds'    => $seeds,
]);

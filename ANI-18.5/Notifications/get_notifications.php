<?php
// Everything the farmer should be told about: task deadlines, harvests, low stock.
// Computed on request from existing tables, so it needs no new database table.
require __DIR__ . '/../config.php';

$uid   = sid();
$today = new DateTimeImmutable('today');           // Asia/Manila (see config.php)
$ymd   = $today->format('Y-m-d');
$items = [];

function days_from(DateTimeImmutable $today, string $date): int {
    return (int)$today->diff(new DateTimeImmutable($date))->format('%r%a');
}

function in_days(int $n): string {
    return $n === 1 ? '1 day' : $n . ' days';
}

function qty($v): string {
    return rtrim(rtrim(number_format((float)$v, 2, '.', ''), '0'), '.');
}

/* ---------- Tasks: overdue, today and the next 3 days ---------- */
$labels = [
    'Water' => 'Watering', 'Fertilize' => 'Fertilizing', 'Weed' => 'Weeding',
    'Pest Control' => 'Pest control', 'Inspect' => 'Inspection', 'Other' => 'Task'
];

$s = $pdo->prepare(
    "SELECT t.id, t.task_date, t.task_type, p.name AS plot_name
     FROM tasks t
     JOIN plots p ON p.id = t.plot_id
     WHERE t.done = 0
       AND p.user_id <=> COALESCE(?, p.user_id)
       AND t.task_date <= DATE_ADD(?, INTERVAL 3 DAY)
     ORDER BY t.task_date, t.id
     LIMIT 40"
);
$s->execute([$uid, $ymd]);

foreach ($s->fetchAll() as $r) {
    $n = days_from($today, $r['task_date']);

    if ($n < 0)       { $bucket = 'overdue'; $level = 'danger'; $detail = 'Overdue by ' . in_days(-$n); $filter = 'overdue'; }
    elseif ($n === 0) { $bucket = 'today';   $level = 'warn';   $detail = 'Due today';                   $filter = 'today'; }
    else              { $bucket = 'soon';    $level = 'info';   $detail = $n === 1 ? 'Due tomorrow' : 'Due in ' . in_days($n); $filter = 'next3'; }

    $items[] = [
        'id'     => 'task-' . $r['id'] . '-' . ($n < 0 ? 'overdue' : $n),
        'type'   => 'task',
        'bucket' => $bucket,
        'level'  => $level,
        'title'  => ($labels[$r['task_type']] ?? 'Task') . ' - ' . $r['plot_name'],
        'detail' => $detail,
        'link'   => 'Tasks/tasks.html?filter=' . $filter,
        'days'   => $n
    ];
}

/* ---------- Harvests: planting is ready within a week and nothing recorded yet ---------- */
$s = $pdo->prepare(
    "SELECT pl.id, pl.expected_harvest_date, p.name AS plot_name
     FROM plots p
     JOIN plantings pl ON pl.id = (SELECT MAX(id) FROM plantings WHERE plot_id = p.id)
     WHERE p.status = 'Planted'
       AND p.user_id <=> COALESCE(?, p.user_id)
       AND pl.expected_harvest_date IS NOT NULL
       AND pl.expected_harvest_date <= DATE_ADD(?, INTERVAL 7 DAY)
       AND NOT EXISTS (
           SELECT 1 FROM harvests h
           WHERE h.plot_id = p.id AND h.harvest_date >= pl.planted_date
       )
     ORDER BY pl.expected_harvest_date
     LIMIT 20"
);
$s->execute([$uid, $ymd]);

foreach ($s->fetchAll() as $r) {
    $n = days_from($today, $r['expected_harvest_date']);

    if ($n < 0)       { $level = 'danger'; $detail = 'Expected ' . in_days(-$n) . ' ago, not recorded yet'; }
    elseif ($n === 0) { $level = 'warn';   $detail = 'Expected today'; }
    else              { $level = $n <= 2 ? 'warn' : 'info'; $detail = $n === 1 ? 'Expected tomorrow' : 'Expected in ' . in_days($n); }

    $items[] = [
        'id'     => 'harvest-' . $r['id'] . '-' . ($n < 0 ? 'overdue' : $n),
        'type'   => 'harvest',
        'bucket' => 'harvest',
        'level'  => $level,
        'title'  => 'Harvest - ' . $r['plot_name'],
        'detail' => $detail,
        'link'   => 'Plots/plots.html',
        'days'   => $n
    ];
}

/* ---------- Inventory: at or below the item's alert level ---------- */
$s = $pdo->prepare(
    "SELECT id, item_name, quantity, unit, threshold
     FROM inventory_items
     WHERE quantity <= threshold AND user_id <=> COALESCE(?, user_id)
     ORDER BY quantity, item_name
     LIMIT 20"
);
$s->execute([$uid]);

foreach ($s->fetchAll() as $r) {
    $out = (float)$r['quantity'] <= 0;

    $items[] = [
        'id'     => 'stock-' . $r['id'] . '-' . qty($r['quantity']),
        'type'   => 'stock',
        'bucket' => 'stock',
        'level'  => $out ? 'danger' : 'warn',
        'title'  => ($out ? 'Out of stock - ' : 'Low stock - ') . $r['item_name'],
        'detail' => qty($r['quantity']) . ' ' . $r['unit'] . ' left, alert at ' . qty($r['threshold']) . ' ' . $r['unit'],
        'link'   => 'Inventory/inventory.html',
        'days'   => null
    ];
}

// Most urgent first (usort is stable in PHP 8, so dates keep their order inside a level)
$rank = ['danger' => 0, 'warn' => 1, 'info' => 2];
usort($items, fn($a, $b) => $rank[$a['level']] <=> $rank[$b['level']]);

$summary = ['task_overdue' => 0, 'task_today' => 0, 'task_soon' => 0, 'harvest' => 0, 'stock' => 0];
foreach ($items as $i) {
    if ($i['type'] === 'task') $summary['task_' . $i['bucket']]++;
    else $summary[$i['type']]++;
}

json_ok(['notifications' => $items, 'summary' => $summary]);

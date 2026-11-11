<?php
require __DIR__ . '/../config.php';

$month = (int)($_GET['month'] ?? date('n'));
$year  = (int)($_GET['year'] ?? date('Y'));

if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) json_error('Invalid month.');

// The calendar grid shows 6 weeks starting on the Sunday on or before the 1st.
$first = sprintf('%04d-%02d-01', $year, $month);
$start = date('Y-m-d', strtotime('-' . (int)date('w', strtotime($first)) . ' days', strtotime($first)));
$end   = date('Y-m-d', strtotime('+41 days', strtotime($start)));
$owner = sid();

$events = [];

$s = $pdo->prepare(
    "SELECT t.id, t.task_date AS date, 'task' AS type, t.task_type AS label, p.name AS plot_name, t.done
     FROM watering_tasks t JOIN plots p ON p.id = t.plot_id
     WHERE t.task_date BETWEEN ? AND ? AND p.user_id <=> COALESCE(?, p.user_id)"
);
$s->execute([$start, $end, $owner]);
$events = array_merge($events, $s->fetchAll());

$s = $pdo->prepare(
    "SELECT pl.id, pl.expected_harvest_date AS date, 'expected' AS type, 'Expected harvest' AS label, p.name AS plot_name, 0 AS done
     FROM plantings pl JOIN plots p ON p.id = pl.plot_id
     WHERE pl.expected_harvest_date BETWEEN ? AND ? AND p.user_id <=> COALESCE(?, p.user_id)"
);
$s->execute([$start, $end, $owner]);
$events = array_merge($events, $s->fetchAll());

$s = $pdo->prepare(
    "SELECT h.id, h.harvest_date AS date, 'harvest' AS type, 'Harvest recorded' AS label, p.name AS plot_name, 0 AS done
     FROM harvests h JOIN plots p ON p.id = h.plot_id
     WHERE h.harvest_date BETWEEN ? AND ? AND p.user_id <=> COALESCE(?, p.user_id)"
);
$s->execute([$start, $end, $owner]);
$events = array_merge($events, $s->fetchAll());

json_ok(['events' => $events]);

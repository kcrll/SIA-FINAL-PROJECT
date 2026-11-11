<?php
require __DIR__ . '/../config.php';

$d = input();
$plot = (int)($d['plot_id'] ?? 0);
$date = date_field($d, 'task_date');
$type = trim((string)($d['task_type'] ?? 'Water'));

if (!in_array($type, ['Water', 'Fertilize', 'Weed', 'Pest Control', 'Inspect', 'Other'], true)) {
    json_error('Select a valid task type.');
}
if (!$plot || !own_plot($pdo, $plot)) json_error('Select one of your plots.');

$pdo->prepare('INSERT INTO watering_tasks (plot_id, task_date, task_type) VALUES (?, ?, ?)')
    ->execute([$plot, $date, $type]);

json_ok(['message' => 'Task added.']);

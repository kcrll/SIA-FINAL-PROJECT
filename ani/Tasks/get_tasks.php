<?php
require __DIR__ . '/../config.php';

$s = $pdo->prepare(
    'SELECT t.id, t.plot_id, t.task_type, t.task_date, t.done, p.name AS plot_name
     FROM watering_tasks t
     JOIN plots p ON p.id = t.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY t.done, t.task_date, t.id'
);
$s->execute([sid()]);

json_ok(['tasks' => $s->fetchAll()]);

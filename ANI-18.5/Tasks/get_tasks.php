<?php

require __DIR__ . '/../config.php';

$sql = "SELECT
            t.*,
            p.name AS plot_name
        FROM tasks t
        JOIN plots p ON p.id = t.plot_id
        WHERE p.user_id <=> COALESCE(?, p.user_id)
        ORDER BY t.done ASC,
                 CASE WHEN t.done = 0 THEN t.task_date END ASC,
                 t.task_date DESC, t.id DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute([sid()]);

json_ok(['tasks' => $stmt->fetchAll()]);

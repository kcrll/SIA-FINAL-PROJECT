<?php
require __DIR__ . '/../config.php';

// Each plot with its latest planting plus the numbers shown in the plot details.
$s = $pdo->prepare(
    "SELECT p.id, p.name, p.status, p.created_at, u.username AS owner,
            pl.id AS planting_id, pl.variety, pl.planted_date, pl.expected_harvest_date,
            pl.notes AS planting_notes,
            (SELECT COUNT(*) FROM watering_tasks t WHERE t.plot_id = p.id AND t.done = 0) AS pending_tasks,
            (SELECT MIN(t.task_date) FROM watering_tasks t WHERE t.plot_id = p.id AND t.done = 0) AS next_task_date,
            (SELECT COALESCE(SUM(h.quantity), 0) FROM harvests h WHERE h.plot_id = p.id) AS total_harvest,
            (SELECT MAX(h.harvest_date) FROM harvests h WHERE h.plot_id = p.id) AS last_harvest
     FROM plots p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN plantings pl ON pl.id = (SELECT MAX(id) FROM plantings WHERE plot_id = p.id)
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY p.id"
);
$s->execute([sid()]);

json_ok(['plots' => $s->fetchAll()]);

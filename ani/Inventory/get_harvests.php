<?php
require __DIR__ . '/../config.php';

$s = $pdo->prepare(
    'SELECT h.id, h.plot_id, h.harvest_date, h.quantity, h.notes, p.name AS plot_name
     FROM harvests h JOIN plots p ON p.id = h.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY h.harvest_date DESC, h.id DESC'
);
$s->execute([sid()]);

json_ok(['harvests' => $s->fetchAll()]);

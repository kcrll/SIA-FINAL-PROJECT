<?php
require __DIR__ . '/../config.php';

$s = $pdo->prepare(
    "SELECT f.id, f.plot_id, f.transaction_type, f.category, f.amount, f.transaction_date, f.notes,
            COALESCE(p.name, 'Whole farm') AS plot_name
     FROM finance_transactions f
     LEFT JOIN plots p ON p.id = f.plot_id
     WHERE f.user_id <=> COALESCE(?, f.user_id)
     ORDER BY f.transaction_date DESC, f.id DESC"
);
$s->execute([sid()]);

json_ok(['transactions' => $s->fetchAll()]);

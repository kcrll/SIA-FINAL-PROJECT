<?php

require __DIR__ . '/../config.php';

$d = input();

$id = (int)($d['id'] ?? 0);

if (!$id) {
    json_error('Invalid harvest.');
}

// Remember the plot first so its status can be recalculated after deletion.
$s = $pdo->prepare(
    'SELECT plot_id FROM harvests
     WHERE id=?
       AND plot_id IN (SELECT id FROM plots WHERE user_id <=> COALESCE(?, user_id))'
);
$s->execute([$id, sid()]);
$plot = (int)$s->fetchColumn();

if (!$plot) {
    json_error('Harvest record not found.', 404);
}

$pdo->beginTransaction();

try {
    $pdo
        ->prepare(
            'DELETE FROM harvests
             WHERE id=?
               AND plot_id IN (SELECT id FROM plots WHERE user_id <=> COALESCE(?, user_id))'
        )
        ->execute([
            $id,
            sid()
        ]);

    refresh_plot_harvest_status($pdo, $plot);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('Unable to delete harvest.');
}

json_ok([
    'message' => 'Harvest deleted.'
]);
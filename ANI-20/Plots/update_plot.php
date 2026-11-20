<?php

require __DIR__ . '/../config.php';

$d = input();

$id = (int)($d['id'] ?? 0);
$name = required($d, 'name');
$status = required($d, 'status');

if (
    !$id ||
    !in_array($status, ['Available', 'Planted', 'Maintenance', 'Harvested'], true)
) {
    json_error('Invalid plot data.');
}

if (!own_plot($pdo, $id)) {
    json_error('Plot not found.', 404);
}

$pdo->beginTransaction();

try {
    if ($status === 'Available') {
        // Reset the plot's crop details. Detach harvests from the planting first
        // so harvest history is kept even though the planting is removed.
        $pdo
            ->prepare(
                'UPDATE harvests SET planting_id=NULL
                 WHERE planting_id IN (SELECT id FROM plantings WHERE plot_id=?)'
            )
            ->execute([$id]);

        $pdo
            ->prepare('DELETE FROM plantings WHERE plot_id=?')
            ->execute([$id]);

        $s = $pdo->prepare(
            'UPDATE plots
             SET name=?, status=?, seed_id=NULL, seed_type=NULL
             WHERE id=? AND user_id <=> COALESCE(?, user_id)'
        );
    } else {
        $s = $pdo->prepare(
            'UPDATE plots
             SET name=?, status=?
             WHERE id=? AND user_id <=> COALESCE(?, user_id)'
        );
    }

    $s->execute([
        $name,
        $status,
        $id,
        sid()
    ]);

    $pdo->commit();

    json_ok([
        'message' => 'Plot updated.'
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_error(
        $e->getCode() === '23000'
            ? 'Plot name already exists.'
            : 'Unable to update plot.'
    );
}
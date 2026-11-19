<?php

require __DIR__ . '/../config.php';

$d = input();

$id = (int)($d['id'] ?? 0);
$date = required($d, 'harvest_date');
$qty = (float)($d['quantity'] ?? 0);
$notes = trim((string)($d['notes'] ?? ''));
$plotId = (int)($d['plot_id'] ?? 0);

if (!$id || $qty <= 0) {
    json_error('Invalid harvest record: valid quantity is required.');
}

if ($plotId > 0 && !own_plot($pdo, $plotId)) {
    json_error('Invalid rice plot.');
}

// Remember the plot the harvest belongs to so both sides stay in sync if it moves.
$s = $pdo->prepare(
    'SELECT plot_id FROM harvests
     WHERE id=?
       AND plot_id IN (SELECT id FROM plots WHERE user_id <=> COALESCE(?, user_id))'
);
$s->execute([$id, sid()]);
$oldPlot = (int)$s->fetchColumn();

if (!$oldPlot) {
    json_error('Harvest record not found.', 404);
}

$pdo->beginTransaction();

try {
    if ($plotId > 0) {
        $s = $pdo->prepare(
            'UPDATE harvests
             SET plot_id=?, harvest_date=?, quantity=?, notes=?
             WHERE id=?
               AND plot_id IN (SELECT id FROM plots WHERE user_id <=> COALESCE(?, user_id))'
        );
        $s->execute([
            $plotId,
            $date,
            $qty,
            $notes ?: null,
            $id,
            sid()
        ]);
    } else {
        $s = $pdo->prepare(
            'UPDATE harvests
             SET harvest_date=?, quantity=?, notes=?
             WHERE id=?
               AND plot_id IN (SELECT id FROM plots WHERE user_id <=> COALESCE(?, user_id))'
        );
        $s->execute([
            $date,
            $qty,
            $notes ?: null,
            $id,
            sid()
        ]);
    }

    $newPlot = $plotId > 0 ? $plotId : $oldPlot;
    refresh_plot_harvest_status($pdo, $newPlot);

    if ($newPlot !== $oldPlot) {
        refresh_plot_harvest_status($pdo, $oldPlot);
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('Unable to update harvest.');
}

$user = $_SESSION['username'] ?? 'User';
log_activity($pdo, $_SESSION['user_id'] ?? null, $user, 'Update Harvest', "Updated harvest ID $id ($qty kg on $date)");

json_ok([
    'message' => 'Harvest updated successfully.'
]);

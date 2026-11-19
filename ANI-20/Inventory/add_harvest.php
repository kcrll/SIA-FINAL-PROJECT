<?php

require __DIR__ . '/../config.php';

$d = input();

$plot = (int)($d['plot_id'] ?? 0);
$date = required($d, 'harvest_date');
$qty = (float)($d['quantity'] ?? 0);
$notes = trim((string)($d['notes'] ?? ''));

if (!$plot || $qty <= 0) {
    json_error(
        'Select a plot and enter a quantity greater than zero.'
    );
}

if (!own_plot($pdo, $plot)) {
    json_error('Invalid rice plot.');
}

$pdo->beginTransaction();

try {
    $s = $pdo->prepare(
        'INSERT INTO harvests(plot_id,harvest_date,quantity,notes)
         VALUES(?,?,?,?)'
    );

    $s->execute([
        $plot,
        $date,
        $qty,
        $notes ?: null
    ]);

    // Mark the plot as harvested in the same transaction so the Plots page
    // (and every other view of plots.status) reflects the harvest immediately.
    refresh_plot_harvest_status($pdo, $plot);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('Unable to log harvest.');
}

$user = $_SESSION['username'] ?? 'User';
log_activity($pdo, $_SESSION['user_id'] ?? null, $user, 'Log Harvest', "Logged $qty kg on $date for plot ID $plot");

json_ok([
    'message' => 'Harvest logged.'
]);
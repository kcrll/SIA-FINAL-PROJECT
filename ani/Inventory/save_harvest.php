<?php
require __DIR__ . '/../config.php';

// Logs a harvest, or updates it when an id is sent.
$d = input();
$id    = (int)($d['id'] ?? 0);
$plot  = (int)($d['plot_id'] ?? 0);
$date  = date_field($d, 'harvest_date');
$qty   = (float)($d['quantity'] ?? 0);
$notes = trim((string)($d['notes'] ?? ''));

if (!$plot || $qty <= 0) json_error('Choose a plot and enter a quantity greater than zero.');
if (!own_plot($pdo, $plot)) json_error('Plot not found.', 404);
if (mb_strlen($notes) > 255) json_error('Notes are too long.');

if ($id) {
    $chk = $pdo->prepare(
        'SELECT COUNT(*) FROM harvests
         WHERE id = ? AND plot_id IN (SELECT id FROM plots WHERE user_id <=> COALESCE(?, user_id))'
    );
    $chk->execute([$id, sid()]);
    if (!(int)$chk->fetchColumn()) json_error('Harvest record not found.', 404);

    $pdo->prepare('UPDATE harvests SET plot_id = ?, harvest_date = ?, quantity = ?, notes = ? WHERE id = ?')
        ->execute([$plot, $date, $qty, $notes ?: null, $id]);

    log_activity($pdo, 'Update Harvest', "Updated harvest ID $id ($qty kg on $date)");
    json_ok(['message' => 'Harvest updated.']);
}

$pdo->prepare('INSERT INTO harvests (plot_id, harvest_date, quantity, notes) VALUES (?, ?, ?, ?)')
    ->execute([$plot, $date, $qty, $notes ?: null]);

log_activity($pdo, 'Log Harvest', "$qty kg from plot ID $plot on $date");
json_ok(['message' => 'Harvest logged.']);

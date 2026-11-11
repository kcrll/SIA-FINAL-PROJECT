<?php
require __DIR__ . '/../config.php';

$d = input();
$plot       = (int)($d['plot_id'] ?? 0);
$plantingId = (int)($d['planting_id'] ?? 0);   // 0 starts a new planting, otherwise edits that one
$variety    = trim((string)($d['variety'] ?? ''));
$planted    = date_field($d, 'planted_date');
$expected   = date_field($d, 'expected_harvest_date', false);
$notes      = trim((string)($d['notes'] ?? ''));

if (!$plot || !own_plot($pdo, $plot)) json_error('Plot not found.', 404);
if ($expected !== null && $expected < $planted) json_error('Expected harvest cannot be before the planting date.');
if (mb_strlen($variety) > 150) json_error('Variety is too long.');

if ($plantingId) {
    $chk = $pdo->prepare('SELECT COUNT(*) FROM plantings WHERE id = ? AND plot_id = ?');
    $chk->execute([$plantingId, $plot]);
    if (!(int)$chk->fetchColumn()) json_error('Planting record not found.', 404);

    $s = $pdo->prepare(
        'UPDATE plantings SET variety = ?, planted_date = ?, expected_harvest_date = ?, notes = ? WHERE id = ?'
    );
    $s->execute([$variety ?: null, $planted, $expected, $notes ?: null, $plantingId]);

    json_ok(['message' => 'Planting updated.']);
}

$pdo->beginTransaction();
$s = $pdo->prepare(
    'INSERT INTO plantings (plot_id, variety, planted_date, expected_harvest_date, notes) VALUES (?, ?, ?, ?, ?)'
);
$s->execute([$plot, $variety ?: null, $planted, $expected, $notes ?: null]);
$pdo->prepare("UPDATE plots SET status = 'Planted' WHERE id = ?")->execute([$plot]);
$pdo->commit();

log_activity($pdo, 'Add Planting', "Planted plot ID $plot on $planted");
json_ok(['message' => 'Planting added.']);

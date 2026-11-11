<?php
require __DIR__ . '/../config.php';

$id = (int)(input()['id'] ?? 0);
if (!$id) json_error('Invalid harvest.');

$s = $pdo->prepare(
    'DELETE FROM harvests
     WHERE id = ? AND plot_id IN (SELECT id FROM plots WHERE user_id <=> COALESCE(?, user_id))'
);
$s->execute([$id, sid()]);

if (!$s->rowCount()) json_error('Harvest record not found.', 404);
json_ok(['message' => 'Harvest deleted.']);

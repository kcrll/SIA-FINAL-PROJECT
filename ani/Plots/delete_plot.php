<?php
require __DIR__ . '/../config.php';

$id = (int)(input()['id'] ?? 0);
if (!$id || !own_plot($pdo, $id)) json_error('Plot not found.', 404);

// Plantings, tasks and harvests of the plot are removed with it (foreign keys).
$pdo->prepare('DELETE FROM plots WHERE id = ?')->execute([$id]);

log_activity($pdo, 'Delete Plot', "Deleted plot ID $id");
json_ok(['message' => 'Plot deleted.']);

<?php
require __DIR__ . '/../config.php';

$id = (int)(input()['id'] ?? 0);
if (!$id) json_error('Invalid transaction.');

$s = $pdo->prepare('DELETE FROM finance_transactions WHERE id = ? AND user_id <=> COALESCE(?, user_id)');
$s->execute([$id, sid()]);

if (!$s->rowCount()) json_error('Transaction not found.', 404);
json_ok(['message' => 'Transaction deleted.']);

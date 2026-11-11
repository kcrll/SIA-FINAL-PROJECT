<?php
require __DIR__ . '/../config.php';

$d = input();
$type     = trim((string)($d['transaction_type'] ?? ''));
$plot     = (int)($d['plot_id'] ?? 0) ?: null;   // empty or "whole_farm" means no plot
$date     = date_field($d, 'transaction_date');
$category = required($d, 'category');
$amount   = (float)($d['amount'] ?? 0);
$notes    = trim((string)($d['notes'] ?? ''));

$categories = [
    'Expense' => ['Seed', 'Fertilizer', 'Pesticide', 'Labor', 'Fuel', 'Other'],
    'Income'  => ['Harvest Sale', 'Other Income'],
];

if (!isset($categories[$type])) json_error('Invalid transaction type.');
if (!in_array($category, $categories[$type], true)) json_error('Invalid category.');
if ($amount <= 0) json_error('Enter an amount greater than zero.');
if (mb_strlen($notes) > 500) json_error('Notes are too long.');
if ($plot !== null && !own_plot($pdo, $plot)) json_error('Plot not found.', 404);

$pdo->prepare(
    'INSERT INTO finance_transactions (user_id, plot_id, transaction_type, category, amount, transaction_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
)->execute([uid(), $plot, $type, $category, $amount, $date, $notes ?: null]);

log_activity($pdo, 'Add Transaction', "$type of PHP " . number_format($amount, 2) . " ($category)");
json_ok(['message' => 'Transaction added.']);

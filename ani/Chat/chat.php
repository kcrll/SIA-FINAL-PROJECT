<?php
// "Ask Ani" chat. Uses the Claude API when ANTHROPIC_API_KEY is set,
// otherwise answers from the database with built-in replies.
require __DIR__ . '/../config.php';

$data    = input();
$message = trim((string)($data['message'] ?? ''));
$history = is_array($data['history'] ?? null) ? $data['history'] : [];

if ($message === '') json_error('Please type a message.');
if (mb_strlen($message) > 500) json_error('Message is too long (max 500 characters).');

$today = date('Y-m-d');
$owner = sid();
$q     = mb_strtolower($message);

$rows = function (string $sql, array $params) use ($pdo): array {
    $s = $pdo->prepare($sql);
    $s->execute($params);
    return $s->fetchAll();
};

/* ---------- Farm snapshot ---------- */

$plots = $rows(
    'SELECT p.id, p.name, p.status, pl.variety, pl.planted_date, pl.expected_harvest_date
     FROM plots p
     LEFT JOIN plantings pl ON pl.id = (SELECT MAX(id) FROM plantings WHERE plot_id = p.id)
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY p.id',
    [$owner]
);

$tasks = $rows(
    'SELECT t.task_type, t.task_date, p.name AS plot_name
     FROM watering_tasks t JOIN plots p ON p.id = t.plot_id
     WHERE t.done = 0 AND p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY t.task_date, t.id LIMIT 30',
    [$owner]
);

$harvests = $rows(
    'SELECT p.name AS plot_name, h.harvest_date, h.quantity
     FROM harvests h JOIN plots p ON p.id = h.plot_id
     WHERE p.user_id <=> COALESCE(?, p.user_id)
     ORDER BY h.harvest_date DESC, h.id DESC LIMIT 5',
    [$owner]
);

$supplies = $rows(
    'SELECT item_name, category, quantity, unit, threshold
     FROM inventory_items WHERE user_id <=> COALESCE(?, user_id) ORDER BY item_name',
    [$owner]
);

$fin = $rows(
    "SELECT COALESCE(SUM(CASE WHEN transaction_type = 'Income' THEN amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN transaction_type = 'Expense' THEN amount END), 0) AS expenses
     FROM finance_transactions WHERE user_id <=> COALESCE(?, user_id)",
    [$owner]
)[0];

$money = fn($n) => '₱' . number_format((float)$n, 2);
$date  = fn($d) => $d ? date('M j, Y', strtotime($d)) : 'not set';

/* ---------- Finance question about one plot ---------- */

$financeWords = ['income', 'expense', 'spent', 'spend', 'profit', 'loss', 'finance', 'revenue', 'earn', 'money', 'kita', 'gastos', 'tubo'];
$isFinance = (bool)array_filter($financeWords, fn($w) => str_contains($q, $w));

if ($isFinance) {
    usort($plots, fn($a, $b) => mb_strlen($b['name']) <=> mb_strlen($a['name']));
    $match = null;
    foreach ($plots as $p) {
        if (preg_match('/(?<!\w)' . preg_quote(mb_strtolower($p['name']), '/') . '(?!\w)/u', $q)) {
            $match = $p;
            break;
        }
    }

    if ($match) {
        $t = $rows(
            "SELECT transaction_type, COALESCE(SUM(amount), 0) AS total
             FROM finance_transactions WHERE plot_id = ? AND user_id <=> COALESCE(?, user_id)
             GROUP BY transaction_type",
            [$match['id'], $owner]
        );
        $sum = ['Income' => 0, 'Expense' => 0];
        foreach ($t as $r) $sum[$r['transaction_type']] = (float)$r['total'];
        $net = $sum['Income'] - $sum['Expense'];

        json_ok([
            'reply' => "{$match['name']}\nIncome: " . $money($sum['Income']) .
                       "\nExpenses: " . $money($sum['Expense']) .
                       "\n" . ($net < 0 ? 'Net loss: ' : 'Net profit: ') . $money(abs($net)),
        ]);
    }
}

/* ---------- Claude API ---------- */

if (ANTHROPIC_API_KEY !== '') {
    $snapshot = json_encode([
        'today'          => $today,
        'plots'          => $plots,
        'pending_tasks'  => $tasks,
        'recent_harvests'=> $harvests,
        'supplies'       => $supplies,
        'finance_totals' => $fin,
    ], JSON_UNESCAPED_UNICODE);

    $system =
        "You are Ani, the friendly assistant inside Ani, a rice farm tracking web app. " .
        "Answer using the farm data below; if it does not contain the answer, say so instead of guessing. " .
        "You can only read data, not change it. Point users to the right page: Plots, Tasks, Calendar, Inventory or Finance. " .
        "Keep answers short, plain and practical (under 120 words). Never invent records or amounts.\n\n" .
        "FARM DATA (JSON):\n" . $snapshot;

    $msgs = [];
    foreach (array_slice($history, -10) as $h) {
        $role = $h['role'] ?? '';
        $text = trim((string)($h['content'] ?? ''));
        if (in_array($role, ['user', 'assistant'], true) && $text !== '') {
            $msgs[] = ['role' => $role, 'content' => mb_substr($text, 0, 1000)];
        }
    }

    // The API needs the first message from the user and alternating roles.
    while ($msgs && $msgs[0]['role'] !== 'user') array_shift($msgs);
    $clean = [];
    foreach ($msgs as $m) {
        if ($clean && end($clean)['role'] === $m['role']) array_pop($clean);
        $clean[] = $m;
    }
    if ($clean && end($clean)['role'] === 'user') array_pop($clean);
    $clean[] = ['role' => 'user', 'content' => $message];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS     => json_encode([
            'model'      => ANTHROPIC_MODEL,
            'max_tokens' => 400,
            'system'     => $system,
            'messages'   => $clean,
        ]),
    ]);

    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($raw === false) json_error('Could not reach the AI service: ' . $err, 502);

    $res = json_decode($raw, true);
    if ($code !== 200 || empty($res['content'][0]['text'])) {
        json_error('AI service error: ' . ($res['error']['message'] ?? 'Unexpected response'), 502);
    }

    json_ok(['reply' => trim($res['content'][0]['text'])]);
}

/* ---------- Built-in answers ---------- */

$has = fn(array $words) => (bool)array_filter($words, fn($w) => str_contains($q, $w));

if (preg_match('/\b(hello|hi|hey|help)\b/u', $q)) {
    $reply = "Hi! I'm Ani. Ask me about your plots, tasks, harvests, supplies or farm finances.";

} elseif ($has(['task', 'todo', 'to do'])) {
    if (!$tasks) {
        $reply = 'You have no pending tasks.';
    } else {
        $overdue  = count(array_filter($tasks, fn($t) => $t['task_date'] < $today));
        $dueToday = count(array_filter($tasks, fn($t) => $t['task_date'] === $today));
        $lines    = array_map(
            fn($t) => '• ' . $t['task_type'] . ' – ' . $t['plot_name'] . ' (' . $date($t['task_date']) . ')',
            array_slice($tasks, 0, 5)
        );
        $reply = count($tasks) . " pending task(s): $overdue overdue, $dueToday due today.\n" . implode("\n", $lines);
    }

} elseif ($has(['harvest'])) {
    if ($has(['expected', 'next', 'when', 'upcoming'])) {
        $up = array_values(array_filter($plots, fn($p) => $p['expected_harvest_date'] && $p['expected_harvest_date'] >= $today));
        usort($up, fn($a, $b) => strcmp($a['expected_harvest_date'], $b['expected_harvest_date']));
        $reply = $up
            ? "Next expected harvest: {$up[0]['name']} on " . $date($up[0]['expected_harvest_date']) . '.'
            : 'No upcoming harvest dates are set yet.';
    } else {
        $reply = $harvests
            ? "Latest harvest: {$harvests[0]['plot_name']}, " . (float)$harvests[0]['quantity'] . ' kg on ' . $date($harvests[0]['harvest_date']) . '.'
            : 'No harvests recorded yet.';
    }

} elseif ($has(['seed', 'stock', 'inventory', 'supply', 'supplies', 'fertilizer'])) {
    $low = array_filter($supplies, fn($x) => (float)$x['quantity'] <= (float)$x['threshold']);
    $reply = $supplies
        ? count($supplies) . ' item(s) in stock. ' .
          ($low ? 'Running low: ' . implode(', ', array_column($low, 'item_name')) . '.' : 'None are running low.')
        : 'No supplies recorded yet.';

} elseif ($isFinance) {
    $net = (float)$fin['income'] - (float)$fin['expenses'];
    $reply = 'Income: ' . $money($fin['income']) . "\nExpenses: " . $money($fin['expenses']) .
             "\n" . ($net < 0 ? 'Net loss: ' : 'Net profit: ') . $money(abs($net));

} elseif ($has(['plot', 'field'])) {
    $reply = $plots
        ? count($plots) . " plot(s):\n" . implode("\n", array_map(
            fn($p) => '• ' . $p['name'] . ' – ' . $p['status'] . ($p['variety'] ? ' (' . $p['variety'] . ')' : ''),
            $plots
        ))
        : 'No plots yet. Add one on the Plots page.';

} else {
    $reply = 'I can answer about plots, tasks, harvests, supplies or finances. Try: "What tasks are pending?"';
}

json_ok(['reply' => $reply]);

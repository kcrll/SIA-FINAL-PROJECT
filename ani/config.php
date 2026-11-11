<?php
// Shared bootstrap for every endpoint: session, database connection and JSON helpers.

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

date_default_timezone_set('Asia/Manila');

// Defaults. Override any of them in config.local.php (not committed).
$host = 'localhost';
$db   = 'aniyatrack';
$user = 'root';
$pass = '';

if (is_file(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';
}

defined('ANI_DEBUG')         || define('ANI_DEBUG', false);
defined('ANTHROPIC_API_KEY') || define('ANTHROPIC_API_KEY', getenv('ANTHROPIC_API_KEY') ?: '');
defined('ANTHROPIC_MODEL')   || define('ANTHROPIC_MODEL', 'claude-haiku-5-5');

set_exception_handler(function (Throwable $e) {
    error_log((string)$e);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => ANI_DEBUG ? $e->getMessage() : 'Something went wrong on the server.',
    ]);
    exit;
});

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed. Start MySQL and import aniyatrack.sql.']);
    exit;
}

/* ---------- Response helpers ---------- */

function input(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : $_POST;
}

function json_ok(array $data = []): void
{
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

function json_error(string $message, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function required(array $data, string $key): string
{
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '') json_error("Missing required field: $key");
    return $value;
}

// A YYYY-MM-DD date from the request. Optional dates return null when empty.
function date_field(array $data, string $key, bool $required = true): ?string
{
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '') {
        if ($required) json_error("Missing required field: $key");
        return null;
    }
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) json_error("Invalid date: $key");
    return $value;
}

/* ---------- Access control ---------- */

function uid(): int
{
    return (int)($_SESSION['user_id'] ?? 0);
}

function is_admin(): bool
{
    return ($_SESSION['role'] ?? '') === 'admin';
}

// Owner filter for farm records. Farmers see their own rows; admins get NULL,
// which matches every row through the idiom:  user_id <=> COALESCE(?, user_id)
function sid(): ?int
{
    return is_admin() ? null : uid();
}

function require_admin(): void
{
    if (!is_admin()) json_error('Administrator privileges required.', 403);
}

// True when the plot exists and belongs to the user (any plot for admins).
function own_plot(PDO $pdo, int $plotId): bool
{
    $s = $pdo->prepare('SELECT COUNT(*) FROM plots WHERE id = ? AND user_id <=> COALESCE(?, user_id)');
    $s->execute([$plotId, sid()]);
    return (int)$s->fetchColumn() > 0;
}

function log_activity(PDO $pdo, string $action, ?string $details = null): void
{
    try {
        $s = $pdo->prepare('INSERT INTO activity_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)');
        $s->execute([uid() ?: null, $_SESSION['username'] ?? 'system', $action, $details, $_SERVER['REMOTE_ADDR'] ?? null]);
    } catch (PDOException $e) {
        error_log($e->getMessage());
    }
}

// Every endpoint needs a login, except those that define PUBLIC_ENDPOINT first.
if (!defined('PUBLIC_ENDPOINT') && !uid()) {
    json_error('Please log in first.', 401);
}

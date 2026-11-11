<?php
// Shared bootstrap: session, database connection and JSON helpers
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

// Return errors as JSON instead of an HTML error page
set_exception_handler(function(Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
    exit;
});

// Philippine time, so "today" matches the farmer's calendar
date_default_timezone_set('Asia/Manila');

// Settings (override in config.local.php)
$host    = 'localhost';
$db      = 'aniyatrack';
$user    = 'root';
$pass    = '';
$charset = 'utf8mb4';

if (is_file(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

// Chatbot: set ANTHROPIC_API_KEY (config.local.php or environment) to enable AI answers
if (!defined('ANTHROPIC_API_KEY')) {
    define('ANTHROPIC_API_KEY', getenv('ANTHROPIC_API_KEY') ?: '');
}

// Database
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed. Start XAMPP MySQL and import aniyatrack.sql.']);
    exit;
}

// Helpers
if (!function_exists('input')) {
    function input(): array {
        $raw  = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
        return $_POST ?: [];
    }
}

if (!function_exists('json_ok')) {
    function json_ok($data = []): void {
        echo json_encode(array_merge(['success' => true], $data));
        exit;
    }
}

if (!function_exists('json_error')) {
    function json_error(string $message, int $code = 400): void {
        http_response_code($code);
        echo json_encode(['success' => false, 'message' => $message]);
        exit;
    }
}

if (!function_exists('required')) {
    function required(array $data, string $key): string {
        $value = trim((string)($data[$key] ?? ''));
        if ($value === '') json_error("Missing required field: $key");
        return $value;
    }
}

// Id of the logged-in user (use when creating a record)
if (!function_exists('uid')) {
    function uid(): int {
        return (int)($_SESSION['user_id'] ?? 0);
    }
}

// Id used to filter records: the user's own id, or NULL so admins see everything
if (!function_exists('sid')) {
    function sid(): ?int {
        return (($_SESSION['role'] ?? '') === 'admin') ? null : uid();
    }
}

// True when the plot exists and the logged-in user may use it
if (!function_exists('own_plot')) {
    function own_plot(PDO $pdo, int $plotId): bool {
        $s = $pdo->prepare(
            "SELECT COUNT(*) FROM plots
             WHERE id=? AND crop_type='Rice'
               AND user_id <=> COALESCE(?, user_id)"
        );
        $s->execute([$plotId, sid()]);
        return (int)$s->fetchColumn() > 0;
    }
}

if (!function_exists('require_admin')) {
    function require_admin(): void {
        if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
            json_error('Administrator privileges required.', 403);
        }
    }
}

if (!function_exists('log_activity')) {
    function log_activity(PDO $pdo, ?int $userId, string $username, string $action, ?string $details = null): void {
        try {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $s = $pdo->prepare('INSERT INTO activity_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)');
            $s->execute([$userId, $username, $action, $details, $ip]);
        } catch (Exception $e) {
            // Logging must never break a request
        }
    }
}

// Every endpoint requires login unless it defines PUBLIC_ENDPOINT
if (!defined('PUBLIC_ENDPOINT') && empty($_SESSION['user_id'])) {
    json_error('Please log in first.', 401);
}

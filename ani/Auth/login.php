<?php
define('PUBLIC_ENDPOINT', true);
require __DIR__ . '/../config.php';

$d = input();
$username = required($d, 'username');
$password = (string)($d['password'] ?? '');

$s = $pdo->prepare('SELECT id, full_name, username, password_hash, role FROM users WHERE username = ?');
$s->execute([$username]);
$user = $s->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_error('Incorrect username or password.');
}

session_regenerate_id(true);
$_SESSION['user_id']  = (int)$user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['role']     = $user['role'];

log_activity($pdo, 'User Login', 'Logged in as ' . $user['role']);

json_ok(['full_name' => $user['full_name'], 'role' => $user['role']]);

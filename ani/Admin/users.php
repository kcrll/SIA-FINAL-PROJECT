<?php
require __DIR__ . '/../config.php';
require_admin();

$d = input();
$action = trim((string)($d['action'] ?? 'list'));
$me = uid();

// Username rules shared by create and update.
function check_username(PDO $pdo, string $username, int $exceptId = 0): void
{
    if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) {
        json_error('Username must be 3-30 characters: letters, numbers, underscore only.');
    }
    $s = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username = ? AND id <> ?');
    $s->execute([$username, $exceptId]);
    if ((int)$s->fetchColumn()) json_error('That username is already taken.');
}

switch ($action) {
    case 'list':
        $users = $pdo->query(
            'SELECT u.id, u.full_name, u.phone, u.username, u.role, u.created_at, (u.id = ' . $me . ') AS is_me,
                    (SELECT COUNT(*) FROM plots p WHERE p.user_id = u.id) AS plots
             FROM users u
             ORDER BY u.id DESC'
        )->fetchAll();
        json_ok(['users' => $users]);

    case 'create':
        $full = required($d, 'full_name');
        $username = required($d, 'username');
        $phone = trim((string)($d['phone'] ?? ''));
        $password = (string)($d['password'] ?? '');
        $role = ($d['role'] ?? '') === 'admin' ? 'admin' : 'user';

        check_username($pdo, $username);
        if (strlen($password) < 6) json_error('Password must be at least 6 characters.');

        $pdo->prepare('INSERT INTO users (full_name, phone, username, password_hash, role) VALUES (?, ?, ?, ?, ?)')
            ->execute([$full, $phone ?: null, $username, password_hash($password, PASSWORD_DEFAULT), $role]);

        log_activity($pdo, 'Create User', "Created '$username' ($role)");
        json_ok(['message' => 'User created.']);

    case 'update':
        $id = (int)($d['id'] ?? 0);
        $full = required($d, 'full_name');
        $username = required($d, 'username');
        $phone = trim((string)($d['phone'] ?? ''));
        $role = ($d['role'] ?? '') === 'admin' ? 'admin' : 'user';

        if (!$id) json_error('Invalid user.');
        if ($id === $me && $role !== 'admin') json_error('You cannot remove your own admin role.');
        check_username($pdo, $username, $id);

        $pdo->prepare('UPDATE users SET full_name = ?, phone = ?, username = ?, role = ? WHERE id = ?')
            ->execute([$full, $phone ?: null, $username, $role, $id]);

        log_activity($pdo, 'Update User', "Updated '$username' (ID $id)");
        json_ok(['message' => 'User updated.']);

    case 'reset_password':
        $id = (int)($d['id'] ?? 0);
        $password = (string)($d['password'] ?? '');

        if (!$id) json_error('Invalid user.');
        if (strlen($password) < 6) json_error('Password must be at least 6 characters.');

        $s = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $s->execute([password_hash($password, PASSWORD_DEFAULT), $id]);

        log_activity($pdo, 'Password Reset', "Reset password for user ID $id");
        json_ok(['message' => 'Password updated.']);

    case 'delete':
        $id = (int)($d['id'] ?? 0);
        if (!$id) json_error('Invalid user.');
        if ($id === $me) json_error('You cannot delete your own account.');

        $s = $pdo->prepare('SELECT username FROM users WHERE id = ?');
        $s->execute([$id]);
        $target = $s->fetch();
        if (!$target) json_error('User not found.', 404);

        // The farm records of the account go with it, so nothing is left without an owner.
        $pdo->beginTransaction();
        foreach (['plots', 'inventory_items', 'finance_transactions'] as $table) {
            $pdo->prepare("DELETE FROM $table WHERE user_id = ?")->execute([$id]);
        }
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        $pdo->commit();

        log_activity($pdo, 'Delete User', "Deleted '{$target['username']}' and their records");
        json_ok(['message' => "{$target['username']} was deleted."]);

    default:
        json_error('Unknown action.');
}

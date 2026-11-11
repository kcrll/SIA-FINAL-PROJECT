<?php
require __DIR__ . '/../config.php';
require_admin();

$d = input();
$action = trim((string)($d['action'] ?? 'list'));
$currentAdminId = (int)$_SESSION['user_id'];
$currentAdminName = (string)$_SESSION['username'];

switch ($action) {
    case 'list':
        $users = $pdo->query(
            "SELECT id, full_name, phone, username, role, status, created_at
             FROM users
             ORDER BY id DESC"
        )->fetchAll();
        json_ok(['users' => $users]);
        break;

    case 'create':
        $full = required($d, 'full_name');
        $phone = trim((string)($d['phone'] ?? ''));
        $username = required($d, 'username');
        $password = (string)($d['password'] ?? '');
        $role = in_array($d['role'] ?? '', ['admin', 'user'], true) ? $d['role'] : 'user';

        if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) {
            json_error('Username must be 3-30 characters: letters, numbers, underscore only.');
        }
        if (strlen($password) < 6) {
            json_error('Password must be at least 6 characters.');
        }

        $chk = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username=?');
        $chk->execute([$username]);
        if ((int)$chk->fetchColumn() > 0) {
            json_error('That username is already taken.');
        }

        $s = $pdo->prepare(
            "INSERT INTO users (full_name, phone, username, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, 'active')"
        );
        $s->execute([
            $full,
            $phone ?: null,
            $username,
            password_hash($password, PASSWORD_DEFAULT),
            $role
        ]);

        log_activity($pdo, $currentAdminId, $currentAdminName, 'Create User', "Created user '$username' (Role: $role)");
        json_ok(['message' => 'User created successfully.', 'id' => $pdo->lastInsertId()]);
        break;

    case 'update':
        $userId = (int)($d['id'] ?? 0);
        $full = required($d, 'full_name');
        $phone = trim((string)($d['phone'] ?? ''));
        $username = required($d, 'username');
        $role = in_array($d['role'] ?? '', ['admin', 'user'], true) ? $d['role'] : 'user';

        if (!$userId) json_error('Invalid user ID.');

        if ($userId === $currentAdminId && $role !== 'admin') {
            json_error('You cannot remove your own admin role.');
        }

        $chk = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username=? AND id != ?');
        $chk->execute([$username, $userId]);
        if ((int)$chk->fetchColumn() > 0) {
            json_error('Username is already taken by another account.');
        }

        $s = $pdo->prepare(
            'UPDATE users SET full_name=?, phone=?, username=?, role=? WHERE id=?'
        );
        $s->execute([$full, $phone ?: null, $username, $role, $userId]);

        log_activity($pdo, $currentAdminId, $currentAdminName, 'Update User', "Updated user ID $userId ($username)");
        json_ok(['message' => 'User account updated.']);
        break;

    case 'approve':
    case 'reject':
        $userId = (int)($d['id'] ?? 0);
        if (!$userId) json_error('Invalid user ID.');

        $s = $pdo->prepare('SELECT username, role, status FROM users WHERE id=?');
        $s->execute([$userId]);
        $target = $s->fetch();

        if (!$target) json_error('User not found.');
        if ($target['role'] !== 'user') json_error('Only farmer accounts can be approved or rejected.');
        if ($target['status'] !== 'pending') json_error('This account is no longer pending approval.');

        $newStatus = ($action === 'approve') ? 'active' : 'rejected';
        $up = $pdo->prepare('UPDATE users SET status=? WHERE id=?');
        $up->execute([$newStatus, $userId]);

        log_activity($pdo, $currentAdminId, $currentAdminName, ucfirst($action) . ' User', "Changed {$target['username']} status to $newStatus");
        json_ok([
            'message' => "Farmer account {$target['username']} has been $newStatus.",
            'status' => $newStatus
        ]);
        break;

    case 'reset_password':
        $userId = (int)($d['id'] ?? 0);
        $newPass = (string)($d['password'] ?? '');

        if (!$userId) json_error('Invalid user ID.');
        if (strlen($newPass) < 6) json_error('Password must be at least 6 characters.');

        $s = $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?');
        $s->execute([password_hash($newPass, PASSWORD_DEFAULT), $userId]);

        log_activity($pdo, $currentAdminId, $currentAdminName, 'Password Reset', "Reset password for user ID $userId");
        json_ok(['message' => 'Password reset successfully.']);
        break;

    case 'delete':
        $userId = (int)($d['id'] ?? 0);
        if (!$userId) json_error('Invalid user ID.');
        if ($userId === $currentAdminId) json_error('You cannot delete your own account.');

        $s = $pdo->prepare('SELECT username FROM users WHERE id=?');
        $s->execute([$userId]);
        $target = $s->fetch();
        if (!$target) json_error('User not found.');

        $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$userId]);

        log_activity($pdo, $currentAdminId, $currentAdminName, 'Delete User', "Deleted user {$target['username']} (ID $userId)");
        json_ok(['message' => "User {$target['username']} deleted successfully."]);
        break;

    default:
        json_error('Invalid action.');
}

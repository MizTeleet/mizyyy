<?php
require_once __DIR__ . '/../includes/app.php';

session_start();
$action = $_GET['action'] ?? '';

if ($action === 'logout') {
    session_destroy();
    header('Location: /index.php');
    exit();
}

$user = current_user_or_null();
if (!$user) {
    json_response(['ok' => false, 'message' => 'Unauthorized'], 401);
}

$conn = db();
if (!$conn) {
    json_response(['ok' => false, 'message' => 'DB unavailable'], 500);
}

$payload = json_decode((string)file_get_contents('php://input'), true) ?: [];

if ($action === 'me') {
    json_response(['ok' => true, 'user' => [
        'id' => (int)$user['public_id'],
        'username' => $user['username'],
        'avatar' => $user['avatar'],
        'role' => badge_role($user),
    ]]);
}

if ($action === 'feed') {
    $sql = 'SELECT f.*, u.username, u.email, u.is_mod FROM feed f JOIN users u ON u.id=f.author_id ORDER BY f.id DESC LIMIT 50';
    $res = $conn->query($sql);
    $items = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = [
            'id' => (int)$row['id'],
            'author' => $row['username'],
            'role' => badge_role($row),
            'text' => $row['text'],
            'image' => $row['image'] ?? '',
            'time' => (int)$row['created_at'],
        ];
    }
    json_response(['ok' => true, 'feed' => $items]);
}

if ($action === 'change_nick') {
    $nick = trim((string)($payload['username'] ?? ''));
    $parts = preg_split('/\s+/u', $nick, -1, PREG_SPLIT_NO_EMPTY);
    if (count($parts) < 3) {
        json_response(['ok' => false, 'message' => 'Ник должен содержать минимум 3 слова']);
    }

    $now = time();
    if (($now - (int)$user['last_nick_change']) < 10800) {
        json_response(['ok' => false, 'message' => 'Менять ник можно раз в 3 часа']);
    }

    $stmt = $conn->prepare('UPDATE users SET username=?, last_nick_change=? WHERE id=?');
    $stmt->bind_param('sii', $nick, $now, $user['id']);
    $stmt->execute();
    json_response(['ok' => true, 'message' => 'Ник обновлен']);
}

if ($action === 'all') {
    if (!in_array(badge_role($user), ['dev', 'mod'], true)) {
        json_response(['ok' => false, 'message' => 'Forbidden'], 403);
    }

    $res = $conn->query('SELECT id, public_id, username, avatar, email, is_mod FROM users ORDER BY id DESC');
    $users = [];
    while ($u = $res->fetch_assoc()) {
        $users[] = [
            'id' => (int)$u['public_id'],
            'username' => $u['username'],
            'avatar' => $u['avatar'],
            'role' => badge_role($u),
        ];
    }

    json_response(['ok' => true, 'users' => $users]);
}

if ($action === 'moderate') {
    $targetPublic = (int)($payload['target_id'] ?? 0);
    $target = user_by_public_id($conn, $targetPublic);
    if (!$target) {
        json_response(['ok' => false, 'message' => 'Пользователь не найден'], 404);
    }

    if (!can_moderate($user, $target)) {
        json_response(['ok' => false, 'message' => 'Недостаточно прав'], 403);
    }

    $a = (string)($payload['action'] ?? '');
    if ($a === 'ban') {
        $target['is_banned'] = 1;
    } elseif ($a === 'rename') {
        $val = trim((string)($payload['value'] ?? ''));
        if ($val !== '') {
            $target['username'] = $val;
        }
    } elseif ($a === 'change_id' && is_dev($user)) {
        $target['public_id'] = next_public_id($conn);
    } elseif ($a === 'freeze') {
        $min = max(1, (int)($payload['value'] ?? 1));
        $target['frozen_until'] = time() + ($min * 60);
    }

    update_user($conn, $target);
    json_response(['ok' => true, 'message' => 'Действие выполнено']);
}

json_response(['ok' => false, 'message' => 'Unknown action'], 400);

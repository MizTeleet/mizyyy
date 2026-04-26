<?php
require_once __DIR__ . '/../includes/app.php';

$user = require_auth();
$conn = db();
if (!$conn) {
    json_response(['ok' => false, 'message' => 'DB unavailable'], 500);
}

$action = $_GET['action'] ?? '';
$payload = json_decode((string)file_get_contents('php://input'), true) ?: [];
$uid = (int)$user['id'];

if ($action === 'list') {
    $stmt = $conn->prepare('SELECT u.public_id, u.username, u.avatar, u.email, u.is_mod
      FROM friends f JOIN users u ON u.id=f.friend_id
      WHERE f.user_id=? ORDER BY u.id DESC');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $res = $stmt->get_result();

    $friends = [];
    while ($u = $res->fetch_assoc()) {
        $friends[] = ['id' => (int)$u['public_id'], 'username' => $u['username'], 'avatar' => $u['avatar'], 'role' => badge_role($u)];
    }

    $newRes = $conn->prepare('SELECT public_id, username, avatar FROM users WHERE id<>? ORDER BY id DESC LIMIT 4');
    $newRes->bind_param('i', $uid);
    $newRes->execute();
    $newQ = $newRes->get_result();
    $newUsers = [];
    while ($n = $newQ->fetch_assoc()) {
        $newUsers[] = ['id' => (int)$n['public_id'], 'username' => $n['username'], 'avatar' => $n['avatar']];
    }

    json_response(['ok' => true, 'friends' => $friends, 'new_users' => $newUsers]);
}

if ($action === 'search') {
    $q = trim((string)($_GET['q'] ?? ''));
    $like = '%' . $q . '%';
    $stmt = $conn->prepare('SELECT public_id, username, avatar, email, is_mod FROM users WHERE id<>? AND (CAST(public_id AS CHAR) LIKE ? OR username LIKE ?) ORDER BY id DESC LIMIT 40');
    $stmt->bind_param('iss', $uid, $like, $like);
    $stmt->execute();
    $res = $stmt->get_result();

    $found = [];
    while ($u = $res->fetch_assoc()) {
        $found[] = ['id' => (int)$u['public_id'], 'username' => $u['username'], 'avatar' => $u['avatar'], 'role' => badge_role($u)];
    }

    json_response(['ok' => true, 'users' => $found]);
}

if ($action === 'add') {
    $friendPublic = (int)($payload['friend_id'] ?? 0);
    $target = user_by_public_id($conn, $friendPublic);
    if (!$target) {
        json_response(['ok' => false, 'message' => 'Пользователь не найден'], 404);
    }

    $stmt = $conn->prepare('INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)');
    $stmt->bind_param('ii', $uid, $target['id']);
    $stmt->execute();
    json_response(['ok' => true]);
}

if ($action === 'remove') {
    $friendPublic = (int)($payload['friend_id'] ?? 0);
    $target = user_by_public_id($conn, $friendPublic);
    if (!$target) {
        json_response(['ok' => true]);
    }

    $stmt = $conn->prepare('DELETE FROM friends WHERE user_id=? AND friend_id=?');
    $stmt->bind_param('ii', $uid, $target['id']);
    $stmt->execute();
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'message' => 'Unknown action'], 400);

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

if ($action === 'send') {
    $toPublic = (int)($payload['to_id'] ?? 0);
    $target = user_by_public_id($conn, $toPublic);
    $text = trim((string)($payload['text'] ?? ''));
    if (!$target || $text === '') {
        json_response(['ok' => false, 'message' => 'Invalid message'], 400);
    }

    $now = time();
    $stmt = $conn->prepare('INSERT INTO messages (from_id, to_id, text, created_at) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('iisi', $uid, $target['id'], $text, $now);
    $stmt->execute();
    json_response(['ok' => true]);
}

if ($action === 'list') {
    $chatPublic = (int)($_GET['chat'] ?? 0);
    $chatUser = user_by_public_id($conn, $chatPublic);
    if (!$chatUser) {
        json_response(['ok' => true, 'messages' => [], 'chat_user' => null]);
    }

    $stmt = $conn->prepare('SELECT id, from_id, text, created_at FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id ASC');
    $stmt->bind_param('iiii', $uid, $chatUser['id'], $chatUser['id'], $uid);
    $stmt->execute();
    $res = $stmt->get_result();
    $messages = [];
    while ($m = $res->fetch_assoc()) {
        $messages[] = [
            'id' => (int)$m['id'],
            'text' => $m['text'],
            'time' => (int)$m['created_at'],
            'from_me' => (int)$m['from_id'] === $uid,
        ];
    }

    json_response(['ok' => true, 'messages' => $messages, 'chat_user' => [
        'id' => (int)$chatUser['public_id'],
        'username' => $chatUser['username'],
        'avatar' => $chatUser['avatar'],
        'role' => badge_role($chatUser),
    ]]);
}

if ($action === 'chats') {
    $stmt = $conn->prepare('SELECT u.id, u.public_id, u.username, u.avatar, u.email, u.is_mod, u.last_seen
      FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.id DESC');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $res = $stmt->get_result();

    $chats = [];
    while ($u = $res->fetch_assoc()) {
        $lastStmt = $conn->prepare('SELECT text FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 1');
        $lastStmt->bind_param('iiii', $uid, $u['id'], $u['id'], $uid);
        $lastStmt->execute();
        $lastRes = $lastStmt->get_result()->fetch_assoc();

        $chats[] = [
            'id' => (int)$u['public_id'],
            'username' => $u['username'],
            'avatar' => $u['avatar'],
            'role' => badge_role($u),
            'online' => (time() - (int)$u['last_seen']) < 120,
            'last_text' => $lastRes['text'] ?? '',
        ];
    }

    json_response(['ok' => true, 'chats' => $chats]);
}

if ($action === 'inbox') {
    $_SESSION['last_msg_check'] ??= time();
    $lastCheck = (int)$_SESSION['last_msg_check'];

    $stmt = $conn->prepare('SELECT m.text, u.username, u.avatar
      FROM messages m JOIN users u ON u.id=m.from_id
      WHERE m.to_id=? AND m.created_at>? ORDER BY m.id DESC LIMIT 5');
    $stmt->bind_param('ii', $uid, $lastCheck);
    $stmt->execute();
    $res = $stmt->get_result();

    $notifications = [];
    while ($row = $res->fetch_assoc()) {
        $notifications[] = ['username' => $row['username'], 'avatar' => $row['avatar'], 'text' => $row['text']];
    }

    $_SESSION['last_msg_check'] = time();
    json_response(['ok' => true, 'notifications' => $notifications]);
}

json_response(['ok' => false, 'message' => 'Unknown action'], 400);

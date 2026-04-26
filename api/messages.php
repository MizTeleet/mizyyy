<?php
require_once __DIR__ . '/../includes/app.php';

$user = require_auth();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';
$body = json_decode((string)file_get_contents('php://input'), true) ?: [];

global $conn;

if ($action === 'chats') {
    $stmt = $conn->prepare('SELECT u.public_id, u.username, u.avatar, u.role, u.last_seen
      FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.last_seen DESC');
    $stmt->bind_param('i', $user['id']);
    $stmt->execute();
    $res = $stmt->get_result();

    $items = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = [
            'id' => (int)$row['public_id'],
            'username' => $row['username'],
            'avatar' => $row['avatar'],
            'role' => $row['role'],
            'online' => time() - (int)$row['last_seen'] < 120,
        ];
    }
    json_response($items);
}

if ($action === 'list') {
    $chatId = (int)($_GET['chat'] ?? 0);
    $find = $conn->prepare('SELECT id FROM users WHERE public_id=? LIMIT 1');
    $find->bind_param('i', $chatId);
    $find->execute();
    $target = $find->get_result()->fetch_assoc();
    if (!$target) {
        json_response([]);
    }

    $stmt = $conn->prepare('SELECT from_id, message, created_at FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id ASC');
    $stmt->bind_param('iiii', $user['id'], $target['id'], $target['id'], $user['id']);
    $stmt->execute();
    $res = $stmt->get_result();

    $items = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = [
            'from' => (int)$row['from_id'],
            'isMe' => (int)$row['from_id'] === (int)$user['id'],
            'message' => $row['message'],
            'time' => (int)$row['created_at'],
        ];
    }
    json_response($items);
}

if ($action === 'send' && $method === 'POST') {
    $chatId = (int)($body['chat'] ?? 0);
    $message = trim((string)($body['message'] ?? ''));
    if ($chatId <= 0 || $message === '') {
        json_response(['ok' => false, 'error' => 'Bad request'], 400);
    }

    $find = $conn->prepare('SELECT id FROM users WHERE public_id=? LIMIT 1');
    $find->bind_param('i', $chatId);
    $find->execute();
    $target = $find->get_result()->fetch_assoc();
    if (!$target) {
        json_response(['ok' => false, 'error' => 'User not found'], 404);
    }

    $now = time();
    $ins = $conn->prepare('INSERT INTO messages (from_id, to_id, message, created_at, seen) VALUES (?, ?, ?, ?, 0)');
    $ins->bind_param('iisi', $user['id'], $target['id'], $message, $now);
    $ins->execute();
    json_response(['ok' => true]);
}

if ($action === 'typing' && $method === 'POST') {
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Unknown action'], 400);

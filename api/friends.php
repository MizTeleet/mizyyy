<?php
require_once __DIR__ . '/../includes/app.php';

$user = require_auth();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';
$body = json_decode((string)file_get_contents('php://input'), true) ?: [];

global $conn;

if ($action === 'list') {
    $stmt = $conn->prepare('SELECT u.public_id, u.username, u.avatar, u.role, u.last_seen
      FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.username ASC');
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

if ($action === 'search') {
    $q = trim((string)($_GET['q'] ?? ''));
    $like = '%' . $q . '%';
    $stmt = $conn->prepare('SELECT public_id, username, avatar, role FROM users WHERE id<>? AND (CAST(public_id AS CHAR) LIKE ? OR username LIKE ?) LIMIT 20');
    $stmt->bind_param('iss', $user['id'], $like, $like);
    $stmt->execute();
    $res = $stmt->get_result();

    $items = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = [
            'id' => (int)$row['public_id'],
            'username' => $row['username'],
            'avatar' => $row['avatar'],
            'role' => $row['role'],
        ];
    }
    json_response($items);
}

if ($action === 'add' && $method === 'POST') {
    $publicId = (int)($body['friend_id'] ?? 0);
    $find = $conn->prepare('SELECT id FROM users WHERE public_id=? LIMIT 1');
    $find->bind_param('i', $publicId);
    $find->execute();
    $target = $find->get_result()->fetch_assoc();
    if (!$target) {
        json_response(['ok' => false, 'error' => 'Not found'], 404);
    }

    $ins = $conn->prepare('INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)');
    $ins->bind_param('ii', $user['id'], $target['id']);
    $ins->execute();
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Unknown action'], 400);

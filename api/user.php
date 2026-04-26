<?php
require_once __DIR__ . '/../includes/app.php';

$user = require_auth();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'profile';
$body = json_decode((string)file_get_contents('php://input'), true) ?: [];

global $conn;

if ($action === 'logout') {
    session_destroy();
    json_response(['ok' => true]);
}

if ($action === 'profile') {
    json_response([
        'id' => (int)$user['public_id'],
        'username' => $user['username'],
        'bio' => (string)$user['bio'],
        'avatar' => $user['avatar'],
        'role' => $user['role'],
        'last_seen' => (int)$user['last_seen']
    ]);
}

if ($action === 'update_nick' && $method === 'POST') {
    $nick = trim((string)($body['username'] ?? ''));
    if (count(preg_split('/\s+/u', $nick, -1, PREG_SPLIT_NO_EMPTY)) < 3) {
        json_response(['ok' => false, 'error' => 'Ник минимум 3 слова'], 400);
    }
    if (time() - (int)$user['last_nick_change'] < 10800) {
        json_response(['ok' => false, 'error' => 'Можно менять раз в 3 часа'], 400);
    }
    $now = time();
    $stmt = $conn->prepare('UPDATE users SET username=?, last_nick_change=? WHERE id=?');
    $stmt->bind_param('sii', $nick, $now, $user['id']);
    $stmt->execute();
    json_response(['ok' => true]);
}

if ($action === 'update_bio' && $method === 'POST') {
    $bio = trim((string)($body['bio'] ?? ''));
    $stmt = $conn->prepare('UPDATE users SET bio=? WHERE id=?');
    $stmt->bind_param('si', $bio, $user['id']);
    $stmt->execute();
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Unknown action'], 400);

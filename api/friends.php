<?php
require_once __DIR__ . '/../includes/app.php';

$user = require_auth();
$data = app_load();
$action = $_GET['action'] ?? '';
$payload = json_decode((string)file_get_contents('php://input'), true) ?: [];
$uid = (int)$user['id'];

$data['friends'][(string)$uid] ??= [];

if ($action === 'list') {
    $friendIds = array_map('intval', $data['friends'][(string)$uid]);

    $friends = array_values(array_filter(array_map(static function (array $u) use ($friendIds): ?array {
        if (!in_array((int)$u['id'], $friendIds, true)) {
            return null;
        }
        return ['id' => $u['id'], 'username' => $u['username'], 'avatar' => $u['avatar'], 'role' => badge_role($u)];
    }, $data['users'])));

    $newUsers = array_slice(array_values(array_filter(array_map(static function (array $u) use ($uid): ?array {
        if ((int)$u['id'] === $uid) {
            return null;
        }
        return ['id' => $u['id'], 'username' => $u['username'], 'avatar' => $u['avatar']];
    }, $data['users']))), -4);

    json_response(['ok' => true, 'friends' => $friends, 'new_users' => $newUsers]);
}

if ($action === 'search') {
    $q = mb_strtolower(trim((string)($_GET['q'] ?? '')));
    $found = [];
    foreach ($data['users'] as $u) {
        if ((int)$u['id'] === $uid) {
            continue;
        }
        $inId = str_contains((string)$u['id'], $q);
        $inName = str_contains(mb_strtolower((string)$u['username']), $q);
        if ($q === '' || $inId || $inName) {
            $found[] = ['id' => $u['id'], 'username' => $u['username'], 'avatar' => $u['avatar'], 'role' => badge_role($u)];
        }
    }
    json_response(['ok' => true, 'users' => $found]);
}

if ($action === 'add') {
    $fid = (int)($payload['friend_id'] ?? 0);
    if ($fid && !in_array($fid, array_map('intval', $data['friends'][(string)$uid]), true)) {
        $data['friends'][(string)$uid][] = $fid;
    }
    app_save($data);
    json_response(['ok' => true]);
}

if ($action === 'remove') {
    $fid = (int)($payload['friend_id'] ?? 0);
    $data['friends'][(string)$uid] = array_values(array_filter($data['friends'][(string)$uid], static fn ($x) => (int)$x !== $fid));
    app_save($data);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'message' => 'Unknown action'], 400);

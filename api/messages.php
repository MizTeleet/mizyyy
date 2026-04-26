<?php
require_once __DIR__ . '/../includes/app.php';

$user = require_auth();
$data = app_load();
$action = $_GET['action'] ?? '';
$payload = json_decode((string)file_get_contents('php://input'), true) ?: [];
$uid = (int)$user['id'];

$data['messages'] ??= [];

function chat_key(int $a, int $b): string
{
    $ids = [$a, $b];
    sort($ids);
    return $ids[0] . '_' . $ids[1];
}

if ($action === 'send') {
    $to = (int)($payload['to_id'] ?? 0);
    $text = trim((string)($payload['text'] ?? ''));
    if ($to <= 0 || $text === '') {
        json_response(['ok' => false, 'message' => 'Invalid message'], 400);
    }

    $k = chat_key($uid, $to);
    $data['messages'][$k] ??= [];
    $data['messages'][$k][] = ['id' => uniqid('m', true), 'from' => $uid, 'to' => $to, 'text' => $text, 'time' => time()];
    app_save($data);

    json_response(['ok' => true]);
}

if ($action === 'list') {
    $chatId = (int)($_GET['chat'] ?? 0);
    $k = chat_key($uid, $chatId);
    $messages = $data['messages'][$k] ?? [];

    $chatUser = null;
    foreach ($data['users'] as $u) {
        if ((int)$u['id'] === $chatId) {
            $chatUser = ['id' => $u['id'], 'username' => $u['username'], 'avatar' => $u['avatar'], 'role' => badge_role($u)];
            break;
        }
    }

    $out = array_map(static fn (array $m): array => [
        'id' => $m['id'],
        'text' => $m['text'],
        'time' => $m['time'],
        'from_me' => (int)$m['from'] === $uid,
    ], $messages);

    json_response(['ok' => true, 'messages' => $out, 'chat_user' => $chatUser]);
}

if ($action === 'chats') {
    $friends = $data['friends'][(string)$uid] ?? [];
    $chats = [];
    foreach ($friends as $fid) {
        foreach ($data['users'] as $u) {
            if ((int)$u['id'] === (int)$fid) {
                $k = chat_key($uid, (int)$fid);
                $list = $data['messages'][$k] ?? [];
                $last = $list ? end($list) : null;
                $chats[] = [
                    'id' => $u['id'],
                    'username' => $u['username'],
                    'avatar' => $u['avatar'],
                    'role' => badge_role($u),
                    'online' => (time() - (int)$u['last_seen']) < 120,
                    'last_text' => $last['text'] ?? '',
                ];
            }
        }
    }

    json_response(['ok' => true, 'chats' => $chats]);
}

if ($action === 'inbox') {
    $_SESSION['last_msg_check'] ??= time();
    $lastCheck = (int)$_SESSION['last_msg_check'];
    $found = [];

    foreach ($data['messages'] as $k => $list) {
        foreach ($list as $m) {
            if ((int)$m['to'] === $uid && (int)$m['time'] > $lastCheck) {
                foreach ($data['users'] as $u) {
                    if ((int)$u['id'] === (int)$m['from']) {
                        $found[] = ['username' => $u['username'], 'avatar' => $u['avatar'], 'text' => $m['text']];
                    }
                }
            }
        }
    }

    $_SESSION['last_msg_check'] = time();
    json_response(['ok' => true, 'notifications' => $found]);
}

json_response(['ok' => false, 'message' => 'Unknown action'], 400);

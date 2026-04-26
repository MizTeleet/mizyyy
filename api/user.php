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

$data = app_load();
$payload = json_decode((string)file_get_contents('php://input'), true) ?: [];

if ($action === 'me') {
    json_response(['ok' => true, 'user' => [
        'id' => $user['id'],
        'username' => $user['username'],
        'avatar' => $user['avatar'],
        'role' => badge_role($user),
    ]]);
}

if ($action === 'feed') {
    if (!$data['feed']) {
        $data['feed'][] = [
            'id' => 1,
            'author_id' => $user['id'],
            'author' => $user['username'],
            'role' => badge_role($user),
            'text' => 'Добро пожаловать в BlackLeet. Здесь будут новости проекта.',
            'image' => '',
            'time' => time(),
        ];
        app_save($data);
    }
    json_response(['ok' => true, 'feed' => $data['feed']]);
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

    $user['username'] = $nick;
    $user['last_nick_change'] = $now;
    update_user($data, $user);
    app_save($data);
    json_response(['ok' => true, 'message' => 'Ник обновлен']);
}

if ($action === 'all') {
    if (!in_array(badge_role($user), ['dev', 'mod'], true)) {
        json_response(['ok' => false, 'message' => 'Forbidden'], 403);
    }

    $users = array_map(static function (array $u): array {
        return [
            'id' => $u['id'],
            'username' => $u['username'],
            'avatar' => $u['avatar'],
            'role' => badge_role($u),
        ];
    }, $data['users']);

    json_response(['ok' => true, 'users' => $users]);
}

if ($action === 'moderate') {
    $targetId = (int)($payload['target_id'] ?? 0);
    $target = null;
    foreach ($data['users'] as $u) {
        if ((int)$u['id'] === $targetId) {
            $target = $u;
            break;
        }
    }

    if (!$target) {
        json_response(['ok' => false, 'message' => 'Пользователь не найден'], 404);
    }

    if (!can_moderate($user, $target)) {
        json_response(['ok' => false, 'message' => 'Недостаточно прав'], 403);
    }

    $a = (string)($payload['action'] ?? '');
    if ($a === 'ban') {
        $target['is_banned'] = true;
    }
    if ($a === 'rename') {
        $val = trim((string)($payload['value'] ?? ''));
        if ($val !== '') {
            $target['username'] = $val;
        }
    }
    if ($a === 'change_id' && is_dev($user)) {
        $target['id'] = (int)$data['next_id'];
        $data['next_id'] = ((int)$data['next_id']) + 1;
    }
    if ($a === 'freeze') {
        $min = max(1, (int)($payload['value'] ?? 1));
        $target['is_frozen_until'] = time() + ($min * 60);
    }

    update_user($data, $target);
    app_save($data);

    json_response(['ok' => true, 'message' => 'Действие выполнено']);
}

json_response(['ok' => false, 'message' => 'Unknown action'], 400);

<?php

declare(strict_types=1);

const DATA_FILE = __DIR__ . '/../data/app.json';
const BASE_ID = 13370000;
const DEV_EMAIL = '999.renk@gmail.com';

function app_load(): array
{
    if (!file_exists(DATA_FILE)) {
        $seed = [
            'next_id' => BASE_ID + 1,
            'users' => [],
            'friends' => [],
            'messages' => [],
            'feed' => [],
        ];
        file_put_contents(DATA_FILE, json_encode($seed, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    $raw = file_get_contents(DATA_FILE);
    $data = json_decode((string)$raw, true);

    if (!is_array($data)) {
        $data = ['next_id' => BASE_ID + 1, 'users' => [], 'friends' => [], 'messages' => [], 'feed' => []];
    }

    $data['users'] ??= [];
    $data['friends'] ??= [];
    $data['messages'] ??= [];
    $data['feed'] ??= [];
    $data['next_id'] ??= BASE_ID + 1;

    return $data;
}

function app_save(array $data): void
{
    file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function badge_role(array $user): string
{
    if (($user['email'] ?? '') === DEV_EMAIL) {
        return 'dev';
    }

    return !empty($user['is_mod']) ? 'mod' : 'user';
}

function user_by_email(array $data, string $email): ?array
{
    foreach ($data['users'] as $user) {
        if (($user['email'] ?? '') === $email) {
            return $user;
        }
    }

    return null;
}

function update_user(array &$data, array $updated): void
{
    foreach ($data['users'] as $i => $user) {
        if (($user['id'] ?? null) === ($updated['id'] ?? null)) {
            $data['users'][$i] = $updated;
            return;
        }
    }
}

function create_user(array &$data, string $email, string $username): array
{
    $id = (int)$data['next_id'];
    $data['next_id'] = $id + 1;

    $user = [
        'id' => $id,
        'email' => $email,
        'username' => $username,
        'avatar' => '/assets/avatars/default.svg',
        'is_mod' => false,
        'is_banned' => false,
        'is_frozen_until' => null,
        'last_nick_change' => 0,
        'last_seen' => time(),
    ];

    if ($email === DEV_EMAIL) {
        $user['username'] = $username ?: 'Black Leet Developer';
    }

    $data['users'][] = $user;
    return $user;
}

function current_user_or_null(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $email = $_SESSION['email'] ?? null;
    if (!$email) {
        return null;
    }

    $data = app_load();
    $user = user_by_email($data, (string)$email);
    if (!$user) {
        return null;
    }

    $user['last_seen'] = time();
    update_user($data, $user);
    app_save($data);

    return $user;
}

function require_auth(): array
{
    $user = current_user_or_null();
    if (!$user) {
        header('Location: /index.php');
        exit();
    }

    return $user;
}

function is_dev(array $user): bool
{
    return ($user['email'] ?? '') === DEV_EMAIL;
}

function can_moderate(array $actor, array $target): bool
{
    if (is_dev($actor)) {
        return true;
    }

    if (badge_role($actor) === 'mod') {
        return badge_role($target) === 'user';
    }

    return false;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

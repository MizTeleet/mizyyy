<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function ensure_schema(): void
{
    global $conn;

    $conn->query('CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        public_id BIGINT UNIQUE,
        email VARCHAR(190) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(190) NOT NULL,
        bio TEXT NULL,
        avatar VARCHAR(255) NOT NULL DEFAULT "/assets/avatars/default.svg",
        role ENUM("user","mod","dev") NOT NULL DEFAULT "user",
        last_nick_change INT NOT NULL DEFAULT 0,
        last_seen INT NOT NULL DEFAULT 0,
        created_at INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $conn->query('CREATE TABLE IF NOT EXISTS friends (
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        PRIMARY KEY(user_id, friend_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $conn->query('CREATE TABLE IF NOT EXISTS messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        from_id INT NOT NULL,
        to_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at INT NOT NULL,
        seen TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function next_public_id(): int
{
    global $conn;
    $res = $conn->query('SELECT MAX(public_id) AS mx FROM users');
    $mx = (int)($res?->fetch_assoc()['mx'] ?? 13370000);
    return max(13370000, $mx) + 1;
}

function require_auth(): array
{
    if (!isset($_SESSION['email'])) {
        header('Location: /index.php');
        exit();
    }

    global $conn;

    $stmt = $conn->prepare('SELECT * FROM users WHERE email=?');
    $stmt->bind_param('s', $_SESSION['email']);
    $stmt->execute();

    $user = $stmt->get_result()->fetch_assoc();
    if (!$user) {
        session_destroy();
        header('Location: /index.php');
        exit();
    }

    $now = time();
    $up = $conn->prepare('UPDATE users SET last_seen=? WHERE id=?');
    $up->bind_param('ii', $now, $user['id']);
    $up->execute();

    return $user;
}

function json_response(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function badge_title(string $role): string
{
    return $role === 'dev' ? 'Разработчик BlackLeet' : ($role === 'mod' ? 'Модератор BlackLeet' : 'Пользователь');
}

ensure_schema();

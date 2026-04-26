<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): ?mysqli
{
    static $conn = null;
    static $initTried = false;

    if ($conn instanceof mysqli) {
        return $conn;
    }

    mysqli_report(MYSQLI_REPORT_OFF);
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_errno) {
        return null;
    }

    $conn->set_charset('utf8mb4');

    if (!$initTried) {
        $initTried = true;
        db_init_schema($conn);
    }

    return $conn;
}

function db_init_schema(mysqli $conn): void
{
    $conn->query('CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        public_id BIGINT UNIQUE,
        email VARCHAR(190) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NULL,
        username VARCHAR(190) NOT NULL,
        avatar VARCHAR(255) NOT NULL DEFAULT "/assets/avatars/default.svg",
        is_mod TINYINT(1) NOT NULL DEFAULT 0,
        is_banned TINYINT(1) NOT NULL DEFAULT 0,
        frozen_until INT NULL,
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
        text TEXT NOT NULL,
        created_at INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $conn->query('CREATE TABLE IF NOT EXISTS feed (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        author_id INT NOT NULL,
        text TEXT NOT NULL,
        image VARCHAR(255) NULL,
        created_at INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function next_public_id(mysqli $conn): int
{
    $res = $conn->query('SELECT MAX(public_id) AS max_id FROM users');
    $row = $res ? $res->fetch_assoc() : null;
    $max = (int)($row['max_id'] ?? BASE_PUBLIC_ID);
    return max(BASE_PUBLIC_ID, $max) + 1;
}

function badge_role(array $user): string
{
    if (($user['email'] ?? '') === DEV_EMAIL) {
        return 'dev';
    }
    return (int)($user['is_mod'] ?? 0) === 1 ? 'mod' : 'user';
}

function badge_html_from_role(string $role): string
{
    if ($role === 'dev') {
        return '<span class="badge-wrap"><span class="badge-star dev"></span><span class="badge-tip">Разработчик системы BlackLeet</span></span>';
    }
    if ($role === 'mod') {
        return '<span class="badge-wrap"><span class="badge-star"></span><span class="badge-tip">Модератор BlackLeet</span></span>';
    }
    return '';
}

function user_by_email(mysqli $conn, string $email): ?array
{
    $stmt = $conn->prepare('SELECT * FROM users WHERE email=? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $res = $stmt->get_result();
    $u = $res->fetch_assoc();
    return $u ?: null;
}

function user_by_public_id(mysqli $conn, int $publicId): ?array
{
    $stmt = $conn->prepare('SELECT * FROM users WHERE public_id=? LIMIT 1');
    $stmt->bind_param('i', $publicId);
    $stmt->execute();
    $res = $stmt->get_result();
    $u = $res->fetch_assoc();
    return $u ?: null;
}

function create_user(mysqli $conn, string $email, string $username, string $password): ?array
{
    $pid = next_public_id($conn);
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $now = time();

    $stmt = $conn->prepare('INSERT INTO users (public_id, email, password_hash, username, avatar, is_mod, is_banned, frozen_until, last_nick_change, last_seen, created_at) VALUES (?, ?, ?, ?, "/assets/avatars/default.svg", 0, 0, NULL, 0, ?, ?)');
    $stmt->bind_param('isssii', $pid, $email, $hash, $username, $now, $now);
    if (!$stmt->execute()) {
        return null;
    }

    return user_by_email($conn, $email);
}

function update_user(mysqli $conn, array $user): void
{
    $stmt = $conn->prepare('UPDATE users SET public_id=?, username=?, avatar=?, is_mod=?, is_banned=?, frozen_until=?, last_nick_change=?, last_seen=? WHERE id=?');
    $frozen = $user['frozen_until'] !== null ? (int)$user['frozen_until'] : null;
    $stmt->bind_param(
        'issiiiiii',
        $user['public_id'],
        $user['username'],
        $user['avatar'],
        $user['is_mod'],
        $user['is_banned'],
        $frozen,
        $user['last_nick_change'],
        $user['last_seen'],
        $user['id']
    );
    $stmt->execute();
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

    $conn = db();
    if (!$conn) {
        return null;
    }

    $user = user_by_email($conn, (string)$email);
    if (!$user) {
        return null;
    }

    $user['last_seen'] = time();
    update_user($conn, $user);
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

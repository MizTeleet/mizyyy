<?php
session_start();

if (!isset($_SESSION['email'])) {
    header('Location: index.php');
    exit();
}

$conn = new mysqli('localhost', 'u527763935_prostomiz', 'Yamaha1337@', 'u527763935_BlackLeet');
if ($conn->connect_error) {
    http_response_code(500);
    exit('DB connection error');
}

$email = $_SESSION['email'];
$stmt = $conn->prepare('SELECT * FROM users WHERE email=? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) {
    session_destroy();
    header('Location: index.php');
    exit();
}

$error = '';
$success = '';

// Смена ника (раз в 3 часа + минимум 3 слова)
if (isset($_POST['change_name'])) {
    $new = trim((string)($_POST['username'] ?? ''));
    $parts = preg_split('/\s+/u', $new, -1, PREG_SPLIT_NO_EMPTY);

    if (count($parts) < 3) {
        $error = 'Ник должен содержать минимум 3 слова.';
    } else {
        $lastChange = (int)($user['last_nick_change'] ?? 0);
        $now = time();

        if ($lastChange > 0 && ($now - $lastChange) < 10800) {
            $error = 'Можно менять ник раз в 3 часа.';
        } else {
            $update = $conn->prepare('UPDATE users SET username=?, last_nick_change=? WHERE id=?');
            $update->bind_param('sii', $new, $now, $user['id']);
            $update->execute();
            header('Location: cabinet.php');
            exit();
        }
    }
}

$isDev = $user['email'] === '999.renk@gmail.com';
$isMod = (bool)($user['is_moderator'] ?? false) || $user['email'] === 'admin@gmail.com';
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BlackLeet Cabinet (PHP bridge)</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#0e1730;color:#fff;padding:24px}
    .box{max-width:760px;margin:0 auto;background:rgba(255,255,255,.07);padding:16px;border-radius:14px}
    .badge{display:inline-block;width:12px;height:12px;transform:rotate(45deg);margin-left:8px}
    .dev{background:#ff2c48}.mod{background:#55a6ff}
    input,button{padding:10px;border-radius:10px;border:0}
    input{width:100%;margin:8px 0 10px}
  </style>
</head>
<body>
  <div class="box">
    <h2>
      <?php echo htmlspecialchars((string)$user['username']); ?>
      <?php if ($isDev): ?><span class="badge dev" title="Разработчик системы"></span><?php endif; ?>
      <?php if ($isMod): ?><span class="badge mod" title="Модератор"></span><?php endif; ?>
    </h2>

    <p>ID: <b><?php echo (int)$user['id']; ?></b></p>
    <p>Email: <?php echo htmlspecialchars((string)$user['email']); ?></p>

    <?php if ($error): ?><p style="color:#ff8797"><?php echo htmlspecialchars($error); ?></p><?php endif; ?>
    <?php if ($success): ?><p style="color:#93ffdb"><?php echo htmlspecialchars($success); ?></p><?php endif; ?>

    <form method="post">
      <label>Сменить ник (раз в 3 часа, минимум 3 слова)</label>
      <input name="username" placeholder="Например: Black Leet Legend" required>
      <button name="change_name" value="1">Сохранить</button>
    </form>

    <p style="opacity:.8">Полный современный интерфейс находится в <b>cabinet.html</b>.</p>
  </div>
</body>
</html>

<?php
require_once __DIR__ . '/includes/app.php';

if (isset($_SESSION['email'])) {
    header('Location: /cabinet.php');
    exit();
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    global $conn;

    $email = trim((string)($_POST['email'] ?? ''));
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Введите корректный email';
    } elseif ($username === '' || mb_strlen($password) < 6) {
        $error = 'Ник обязателен, пароль минимум 6 символов';
    } else {
        $stmt = $conn->prepare('SELECT * FROM users WHERE email=?');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        if (!$user) {
            $pid = next_public_id();
            $role = $email === '999.renk@gmail.com' ? 'dev' : 'user';
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $now = time();
            $ins = $conn->prepare('INSERT INTO users (public_id,email,password_hash,username,bio,avatar,role,last_nick_change,last_seen,created_at) VALUES (?,?,?,?,?,"/assets/avatars/default.svg",?,0,?,?)');
            $bio = '';
            $ins->bind_param('isssssii', $pid, $email, $hash, $username, $bio, $role, $now, $now);
            $ins->execute();
            $_SESSION['email'] = $email;
            header('Location: /cabinet.php');
            exit();
        }

        if (!password_verify($password, (string)$user['password_hash'])) {
            $error = 'Неверный пароль';
        } else {
            $_SESSION['email'] = $email;
            header('Location: /cabinet.php');
            exit();
        }
    }
}
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BlackLeet — Login</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="auth-body">
  <section class="auth-card panel">
    <h1>BlackLeet</h1>
    <p class="muted">Вход / регистрация в одну форму</p>
    <?php if ($error): ?><div class="error"><?php echo htmlspecialchars($error); ?></div><?php endif; ?>
    <form method="post" class="auth-form">
      <input type="email" name="email" placeholder="Email" required>
      <input name="username" placeholder="Ник" required>
      <input type="password" name="password" placeholder="Пароль" required>
      <button type="submit">Войти</button>
    </form>
  </section>
</body>
</html>

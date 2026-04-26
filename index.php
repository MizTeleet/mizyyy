<?php
require_once __DIR__ . '/includes/app.php';

session_start();
if (isset($_SESSION['email'])) {
    header('Location: /cabinet.php');
    exit();
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim((string)($_POST['email'] ?? ''));
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Введите корректный email.';
    } elseif ($username === '') {
        $error = 'Введите ник.';
    } elseif (mb_strlen($password) < 6) {
        $error = 'Пароль минимум 6 символов.';
    } else {
        $user = null;
        $conn = db();
        if (!$conn) {
            $error = 'База данных недоступна. Проверьте доступы.';
        } else {
            $user = user_by_email($conn, $email);
        }
        if (!$error && !$user) {
            $user = create_user($conn, $email, $username, $password);
        } elseif (!$error && $user && !password_verify($password, (string)$user['password_hash'])) {
            $error = 'Неверный пароль.';
        }

        if (!$error && $user) {
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
  <title>BlackLeet — вход</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  <div style="max-width:420px;margin:8vh auto" class="panel main">
    <h2>BlackLeet</h2>
    <p class="small">Вход / регистрация. ID назначается автоматически: 13370001, 13370002...</p>
    <?php if ($error): ?><div class="card" style="border-color:#ff617c"><?php echo htmlspecialchars($error); ?></div><?php endif; ?>
    <form method="post">
      <label>Email</label>
      <input type="email" name="email" required placeholder="you@mail.com">
      <label>Ник</label>
      <input name="username" required placeholder="Ваш ник">
      <label>Пароль</label>
      <input type="password" name="password" required placeholder="Минимум 6 символов">
      <button class="btn primary" style="margin-top:10px">Войти</button>
    </form>
  </div>
</body>
</html>

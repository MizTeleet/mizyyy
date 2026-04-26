<?php
require_once __DIR__ . '/app.php';

function render_layout_start(string $title, string $active, array $user): void
{
    $badge = badge_role($user);
    ?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title><?php echo htmlspecialchars($title); ?></title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<div id="dim" class="dim"></div>
<div id="notice" class="notice"></div>
<div class="app">
  <aside class="panel sidebar">
    <div class="profile">
      <img class="avatar" src="<?php echo htmlspecialchars((string)$user['avatar']); ?>" data-me-avatar alt="avatar">
      <div>
        <b data-me-name><?php echo htmlspecialchars((string)$user['username']); ?></b>
        <span data-me-badge><?php echo $badge; ?></span>
        <div class="small">ID: <span data-me-id><?php echo (int)$user['id']; ?></span></div>
      </div>
    </div>
    <div class="nav">
      <button class="<?php echo $active === 'cabinet' ? 'active' : ''; ?>" onclick="location.href='/cabinet.php'">Главная</button>
      <button class="<?php echo $active === 'friends' ? 'active' : ''; ?>" onclick="location.href='/friends.php'">Друзья</button>
      <button class="<?php echo $active === 'messages' ? 'active' : ''; ?>" onclick="location.href='/messages.php'">Сообщения</button>
      <button class="<?php echo $active === 'profile' ? 'active' : ''; ?>" onclick="location.href='/profile.php'">Профиль</button>
      <button onclick="location.href='/api/user.php?action=logout'">Выйти</button>
    </div>

    <?php if (in_array(badge_role($user), ['dev', 'mod'], true)): ?>
      <div class="card dev-users">
        <b>Пользователи сайта</b>
        <div id="devUsers" style="margin-top:10px"></div>
      </div>
    <?php endif; ?>

    <div class="card new-users-bottom">
      <b>Новые пользователи</b>
      <div id="newUsers" style="margin-top:10px"></div>
    </div>
  </aside>
  <main class="panel main">
<?php
}

function render_layout_end(): void
{
    ?>
  </main>
</div>
<script src="/assets/js/app.js"></script>
</body>
</html>
<?php
}

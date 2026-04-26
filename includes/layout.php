<?php
require_once __DIR__ . '/app.php';

function render_layout_start(string $title, string $active, array $user): void
{
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title><?php echo htmlspecialchars($title); ?></title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body data-page="<?php echo htmlspecialchars($active); ?>" data-user-id="<?php echo (int)$user['public_id']; ?>">
  <div id="overlay" class="overlay"></div>
  <header class="topbar panel">
    <button id="menuToggle" class="menu-btn">☰</button>
    <div class="brand">BlackLeet</div>
    <div id="topNotice" class="top-notice"></div>
  </header>

  <div class="app-shell">
    <aside id="sidebar" class="sidebar panel">
      <div class="profile-box">
        <img class="avatar" src="<?php echo htmlspecialchars((string)$user['avatar']); ?>" alt="avatar" id="meAvatar">
        <div>
          <div class="name-line">
            <span id="meName"><?php echo htmlspecialchars((string)$user['username']); ?></span>
            <span class="badge <?php echo htmlspecialchars((string)$user['role']); ?>" title="<?php echo htmlspecialchars(badge_title((string)$user['role'])); ?>"></span>
          </div>
          <div class="muted">ID: <span id="meId"><?php echo (int)$user['public_id']; ?></span></div>
        </div>
      </div>

      <nav class="nav-links">
        <a class="<?php echo $active === 'cabinet' ? 'active' : ''; ?>" href="/cabinet.php">Главная</a>
        <a class="<?php echo $active === 'messages' ? 'active' : ''; ?>" href="/messages.php">Сообщения</a>
        <a class="<?php echo $active === 'friends' ? 'active' : ''; ?>" href="/friends.php">Друзья</a>
        <a class="<?php echo $active === 'profile' ? 'active' : ''; ?>" href="/profile.php">Профиль</a>
      </nav>
      <button id="logoutBtn" class="danger-btn">Выйти</button>
    </aside>

    <main class="content panel">
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

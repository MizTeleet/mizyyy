<?php
require_once __DIR__ . '/includes/app.php';
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet — Cabinet', 'cabinet', $user);
?>
<section class="feed-wide">
  <h1>Кабинет BlackLeet</h1>
  <p class="small">Старый формат интерфейса возвращен: отдельные большие кнопки перехода на страницы.</p>

  <div class="card">
    <div class="row" style="flex-wrap:wrap;gap:12px">
      <button class="btn primary" onclick="location.href='/messages.php'">💬 Сообщения</button>
      <button class="btn primary" onclick="location.href='/friends.php'">👥 Друзья</button>
      <button class="btn primary" onclick="location.href='/profile.php'">🙍 Профиль</button>
    </div>
  </div>

  <div class="card">
    <h3 style="margin-top:0">Ваш аккаунт</h3>
    <div class="row">
      <img class="avatar lg" src="<?php echo htmlspecialchars((string)$user['avatar']); ?>" alt="avatar">
      <div>
        <b><?php echo htmlspecialchars((string)$user['username']); ?></b>
        <?php echo badge_html_from_role(badge_role($user)); ?>
        <div class="small">ID: <?php echo (int)$user['public_id']; ?></div>
      </div>
    </div>
  </div>

  <h2>Лента BlackLeet</h2>
  <div id="feedList"></div>
</section>
<?php render_layout_end(); ?>

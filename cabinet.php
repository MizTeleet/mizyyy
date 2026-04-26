<?php
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet – Cabinet', 'cabinet', $user);
?>
<section>
  <h1>Главная</h1>
  <p class="muted">Переходы как в старом интерфейсе.</p>
  <div class="quick-actions">
    <a href="/messages.php" class="action">💬 Сообщения</a>
    <a href="/friends.php" class="action">👥 Друзья</a>
    <a href="/profile.php" class="action">🙍 Профиль</a>
  </div>
</section>
<?php render_layout_end(); ?>

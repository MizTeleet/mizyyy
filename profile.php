<?php
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet – Profile', 'profile', $user);
?>
<section>
  <h1>Профиль</h1>
  <div class="profile-card">
    <img id="profileAvatar" src="<?php echo htmlspecialchars((string)$user['avatar']); ?>" class="avatar big" alt="avatar">
    <div>
      <div id="profileName"><?php echo htmlspecialchars((string)$user['username']); ?></div>
      <div class="muted">ID: <?php echo (int)$user['public_id']; ?></div>
    </div>
  </div>

  <h3>Смена ника</h3>
  <input id="nickInput" type="text" placeholder="Минимум 3 слова">
  <button id="saveNickBtn" type="button">Сохранить ник</button>

  <h3>Описание</h3>
  <textarea id="bioInput" placeholder="Описание профиля"></textarea>
  <button id="saveBioBtn" type="button">Сохранить описание</button>
</section>
<?php render_layout_end(); ?>

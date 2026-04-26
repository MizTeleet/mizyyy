<?php
require_once __DIR__ . '/includes/app.php';
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet — Profile', 'profile', $user);
?>
<h1>Профиль</h1>
<div class="card">
  <div class="row">
    <img class="avatar lg" src="<?php echo htmlspecialchars((string)$user['avatar']); ?>" data-me-avatar>
    <div>
      <h3 style="margin:0"><span data-me-name></span> <span data-me-badge></span></h3>
      <div class="small">ID: <span data-me-id></span></div>
    </div>
  </div>
</div>
<div class="card">
  <h3>Смена ника</h3>
  <p class="small">Можно менять раз в 3 часа, минимум 3 слова.</p>
  <input id="newNick" placeholder="Например: Black Leet Master">
  <button class="btn primary" style="margin-top:10px" onclick="saveNick()">Сохранить</button>
</div>
<?php render_layout_end(); ?>

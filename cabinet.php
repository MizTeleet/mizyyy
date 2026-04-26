<?php
require_once __DIR__ . '/includes/app.php';
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet — Cabinet', 'cabinet', $user);
?>
<section class="feed-wide">
  <h1>Лента BlackLeet</h1>
  <p class="small">Лента как новостные статьи на весь экран. Публикации делают модераторы и разработчик.</p>
  <div id="feedList"></div>
</section>
<?php render_layout_end(); ?>

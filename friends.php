<?php
require_once __DIR__ . '/includes/app.php';
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet — Friends', 'friends', $user);
?>
<h1>Друзья</h1>
<div class="row" style="margin-bottom:10px">
  <input id="friendQuery" placeholder="Поиск по ID или нику">
  <button class="btn primary" onclick="searchFriends()">Найти</button>
</div>
<div id="searchResults"></div>
<hr style="border-color:rgba(255,255,255,.14)">
<div id="friendsList"></div>
<?php render_layout_end(); ?>

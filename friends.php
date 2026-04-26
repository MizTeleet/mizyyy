<?php
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet – Friends', 'friends', $user);
?>
<section>
  <h1>Друзья</h1>
  <div class="search-row">
    <input id="friendSearch" type="text" placeholder="Поиск по ID или нику">
    <button id="searchFriendBtn" type="button">Найти</button>
  </div>
  <div id="friendsSearchResult"></div>
  <h2>Мои друзья</h2>
  <div id="friendsList"></div>
</section>
<?php render_layout_end(); ?>

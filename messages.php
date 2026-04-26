<?php
require_once __DIR__ . '/includes/app.php';
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet — Messages', 'messages', $user);
?>
<h1>Сообщения</h1>
<div class="messages-layout">
  <aside id="chatList" class="chat-list"></aside>
  <section class="chat-view">
    <div class="row between" style="margin-bottom:8px">
      <div><button class="btn" onclick="location.href='/messages.php'">← Чаты</button></div>
      <b id="chatTitle">Выберите чат</b>
    </div>
    <div id="chatMessages" class="chat-scroll"></div>
    <div class="chat-input">
      <input id="msgInput" placeholder="Напишите сообщение...">
      <button class="btn primary" onclick="sendMessage()">Отправить</button>
    </div>
  </section>
</div>
<?php render_layout_end(); ?>

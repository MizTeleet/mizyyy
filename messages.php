<?php
require_once __DIR__ . '/includes/layout.php';

$user = require_auth();
render_layout_start('BlackLeet – Messages', 'messages', $user);
?>
<section class="messages-wrap">
  <aside id="chatList" class="chat-list"></aside>
  <section class="chat-area">
    <header class="chat-head">
      <button id="backChats" class="ghost">← Чаты</button>
      <div id="chatTitle">Выберите чат</div>
      <div id="typingStatus" class="muted"></div>
    </header>
    <div id="chatMessages" class="chat-messages"></div>
    <div class="chat-input-row">
      <input id="chatInput" type="text" placeholder="Напишите сообщение...">
      <button id="sendMessageBtn" type="button">Отправить</button>
    </div>
  </section>
</section>
<?php render_layout_end(); ?>

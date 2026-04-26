let currentChatId = null;
let lastData = '';
let pollTimer = null;

function qs(id) { return document.getElementById(id); }

function badgeHtml(role) {
  if (role === 'dev') return '<span class="badge dev" title="Разработчик BlackLeet"></span>';
  if (role === 'mod') return '<span class="badge mod" title="Модератор BlackLeet"></span>';
  return '';
}

async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function createUserRow(item, actionBtn) {
  const row = document.createElement('div');
  row.className = 'friend-item';

  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.alignItems = 'center';
  left.style.gap = '8px';

  const avatar = document.createElement('img');
  avatar.className = 'avatar';
  avatar.src = item.avatar;

  const text = document.createElement('div');
  const name = document.createElement('div');
  name.innerHTML = `${item.username} ${badgeHtml(item.role)}`;
  const id = document.createElement('div');
  id.className = 'muted';
  id.textContent = `ID: ${item.id}`;
  text.appendChild(name);
  text.appendChild(id);

  left.appendChild(avatar);
  left.appendChild(text);
  row.appendChild(left);
  row.appendChild(actionBtn);
  return row;
}

function renderMessages(messages) {
  const box = qs('chatMessages');
  if (!box) return;

  box.innerHTML = '';

  messages.forEach((msg) => {
    const div = document.createElement('div');
    div.className = 'msg' + (msg.isMe ? ' me' : '');
    div.textContent = msg.message;
    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

async function loadChat(chatId) {
  if (!chatId) return;
  const data = await apiGet(`/api/messages.php?action=list&chat=${chatId}`);
  const newData = JSON.stringify(data);
  if (newData === lastData) return;
  lastData = newData;
  renderMessages(data);
}

async function loadChats() {
  const box = qs('chatList');
  if (!box) return;

  const chats = await apiGet('/api/messages.php?action=chats');
  box.innerHTML = '';

  chats.forEach((chat) => {
    const btn = document.createElement('button');
    btn.className = 'chat-item';
    btn.type = 'button';
    btn.innerHTML = `<span>${chat.username} ${badgeHtml(chat.role)}</span><span class="muted">${chat.online ? 'online' : 'offline'}</span>`;
    btn.addEventListener('click', () => {
      currentChatId = chat.id;
      lastData = '';
      const title = qs('chatTitle');
      if (title) title.textContent = `${chat.username} (ID ${chat.id})`;
      loadChat(currentChatId);
      if (window.innerWidth < 940) box.classList.add('hidden-mobile');
    });
    box.appendChild(btn);
  });
}

async function sendMessage() {
  const input = qs('chatInput');
  if (!input || !currentChatId) return;
  const text = input.value.trim();
  if (!text) return;

  await apiPost('/api/messages.php?action=send', { chat: currentChatId, message: text });
  input.value = '';
  lastData = '';
  await loadChat(currentChatId);
}

async function loadFriends() {
  const list = qs('friendsList');
  if (!list) return;

  const friends = await apiGet('/api/friends.php?action=list');
  list.innerHTML = '';
  friends.forEach((f) => {
    const btn = document.createElement('button');
    btn.textContent = 'Чат';
    btn.addEventListener('click', () => {
      location.href = '/messages.php';
      sessionStorage.setItem('open_chat_id', String(f.id));
    });
    list.appendChild(createUserRow(f, btn));
  });
}

async function searchFriends() {
  const input = qs('friendSearch');
  const out = qs('friendsSearchResult');
  if (!input || !out) return;

  const items = await apiGet(`/api/friends.php?action=search&q=${encodeURIComponent(input.value.trim())}`);
  out.innerHTML = '';

  items.forEach((f) => {
    const btn = document.createElement('button');
    btn.textContent = 'Добавить';
    btn.addEventListener('click', async () => {
      await apiPost('/api/friends.php?action=add', { friend_id: f.id });
      await loadFriends();
    });
    out.appendChild(createUserRow(f, btn));
  });
}

async function saveNick() {
  const nick = qs('nickInput')?.value?.trim() || '';
  const res = await apiPost('/api/user.php?action=update_nick', { username: nick });
  if (res.ok) location.reload();
  else alert(res.error || 'Ошибка');
}

async function saveBio() {
  const bio = qs('bioInput')?.value || '';
  const res = await apiPost('/api/user.php?action=update_bio', { bio });
  if (!res.ok) alert(res.error || 'Ошибка');
}

async function logout() {
  await apiGet('/api/user.php?action=logout');
  location.href = '/index.php';
}

function initMenu() {
  const sidebar = qs('sidebar');
  const overlay = qs('overlay');
  const toggle = qs('menuToggle');
  if (!sidebar || !overlay || !toggle) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

function initTyping() {
  const input = qs('chatInput');
  const typing = qs('typingStatus');
  if (!input || !typing) return;

  input.addEventListener('input', () => {
    typing.textContent = 'typing...';
    clearTimeout(window.__typingTimer);
    window.__typingTimer = setTimeout(() => {
      typing.textContent = '';
    }, 700);
  });
}

async function initNotifications() {
  const notice = qs('topNotice');
  if (!notice) return;
  const profile = await apiGet('/api/user.php?action=profile');
  notice.textContent = `Онлайн: ${profile.username}`;
}

function initPage() {
  initMenu();
  initTyping();
  initNotifications();

  const page = document.body.dataset.page;
  qs('logoutBtn')?.addEventListener('click', logout);

  if (page === 'messages') {
    qs('sendMessageBtn')?.addEventListener('click', sendMessage);
    qs('backChats')?.addEventListener('click', () => qs('chatList')?.classList.remove('hidden-mobile'));
    loadChats().then(() => {
      const pre = Number(sessionStorage.getItem('open_chat_id') || 0);
      if (pre) {
        currentChatId = pre;
        loadChat(currentChatId);
        sessionStorage.removeItem('open_chat_id');
      }
      pollTimer = setInterval(() => loadChat(currentChatId), 1500);
    });
  }

  if (page === 'friends') {
    qs('searchFriendBtn')?.addEventListener('click', searchFriends);
    loadFriends();
  }

  if (page === 'profile') {
    apiGet('/api/user.php?action=profile').then((p) => {
      const bio = qs('bioInput');
      if (bio) bio.value = p.bio || '';
    });
    qs('saveNickBtn')?.addEventListener('click', saveNick);
    qs('saveBioBtn')?.addEventListener('click', saveBio);
  }
}

document.addEventListener('DOMContentLoaded', initPage);

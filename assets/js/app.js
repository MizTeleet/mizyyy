const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.json();
}

function badgeHtml(role) {
  if (role === "dev") return `<span class="badge-wrap"><span class="badge-star dev"></span><span class="badge-tip">Разработчик системы BlackLeet</span></span>`;
  if (role === "mod") return `<span class="badge-wrap"><span class="badge-star"></span><span class="badge-tip">Модератор BlackLeet</span></span>`;
  return "";
}

function showNotice(msg) {
  const dim = $("#dim");
  const n = $("#notice");
  if (!dim || !n) return;
  n.innerHTML = msg;
  dim.classList.add("show");
  n.classList.add("show");
  n.onclick = () => {
    dim.classList.remove("show");
    n.classList.remove("show");
    window.location.href = "/messages.php";
  };
  setTimeout(() => {
    dim.classList.remove("show");
    n.classList.remove("show");
  }, 3500);
}

async function loadMe() {
  const r = await api("/api/user.php?action=me");
  if (!r.ok) return;
  const me = r.user;
  $$("[data-me-name]").forEach((el) => (el.textContent = me.username));
  $$("[data-me-id]").forEach((el) => (el.textContent = me.id));
  $$("[data-me-avatar]").forEach((el) => (el.src = me.avatar));
  $$("[data-me-badge]").forEach((el) => (el.innerHTML = badgeHtml(me.role)));
}

async function loadFeed() {
  const box = $("#feedList");
  if (!box) return;
  const r = await api("/api/user.php?action=feed");
  if (!r.ok) return;

  box.innerHTML = r.feed
    .map(
      (p) => `<article class="card feed-item">
      <div class="row between"><h3>${p.author} ${badgeHtml(p.role)}</h3><span class="small">${new Date(p.time * 1000).toLocaleString("ru-RU")}</span></div>
      <p>${p.text}</p>
      ${p.image ? `<img src="${p.image}" alt="post">` : ""}
    </article>`
    )
    .join("");
}

async function loadFriends() {
  const box = $("#friendsList");
  if (!box) return;
  const r = await api("/api/friends.php?action=list");
  if (!r.ok) return;

  box.innerHTML = r.friends
    .map(
      (u) => `<div class="card row between">
      <div class="row"><img class="avatar sm" src="${u.avatar}"><div><b>${u.username}</b> ${badgeHtml(u.role)}<div class="small">ID ${u.id}</div></div></div>
      <div class="row"><button class="btn" onclick="openChat(${u.id})">Чат</button><button class="btn danger" onclick="removeFriend(${u.id})">Удалить</button></div>
    </div>`
    )
    .join("");

  const newUsers = $("#newUsers");
  if (newUsers) {
    newUsers.innerHTML = r.new_users
      .map((u) => `<div class="row" style="margin-bottom:8px"><img class="avatar sm" src="${u.avatar}"><div>${u.username}<div class="small">ID ${u.id}</div></div></div>`)
      .join("");
  }
}

async function removeFriend(id) {
  await api("/api/friends.php?action=remove", { method: "POST", body: JSON.stringify({ friend_id: id }) });
  loadFriends();
}
window.removeFriend = removeFriend;
window.openChat = (id) => (window.location.href = `/messages.php?chat=${id}`);

async function searchFriends() {
  const q = $("#friendQuery").value.trim();
  const r = await api(`/api/friends.php?action=search&q=${encodeURIComponent(q)}`);
  const box = $("#searchResults");
  box.innerHTML = r.users
    .map(
      (u) => `<div class="card row between"><div class="row"><img class="avatar sm" src="${u.avatar}"><div><b>${u.username}</b> ${badgeHtml(u.role)}<div class="small">ID ${u.id}</div></div></div><button class="btn primary" onclick="addFriend(${u.id})">Добавить</button></div>`
    )
    .join("");
}
window.searchFriends = searchFriends;
window.addFriend = async (id) => {
  await api("/api/friends.php?action=add", { method: "POST", body: JSON.stringify({ friend_id: id }) });
  loadFriends();
  $("#searchResults").innerHTML = "";
};

async function loadChats() {
  const list = $("#chatList");
  if (!list) return;
  const r = await api("/api/messages.php?action=chats");
  list.innerHTML = r.chats
    .map(
      (c) => `<button class="btn" style="width:100%;text-align:left;margin-bottom:8px" onclick="selectChat(${c.id})"><div class="row between"><span>${c.username} ${badgeHtml(c.role)}</span><span class="small">${c.online ? "online" : "offline"}</span></div><div class="small">${c.last_text || "Нет сообщений"}</div></button>`
    )
    .join("");
}
window.selectChat = (id) => {
  const u = new URL(window.location.href);
  u.searchParams.set("chat", id);
  window.location.href = u.toString();
};

async function loadMessages() {
  const box = $("#chatMessages");
  if (!box) return;
  const params = new URLSearchParams(location.search);
  const chat = params.get("chat");
  if (!chat) return;

  const r = await api(`/api/messages.php?action=list&chat=${chat}`);
  $("#chatTitle").innerHTML = `${r.chat_user.username} ${badgeHtml(r.chat_user.role)} <span class="small">ID ${r.chat_user.id}</span>`;
  box.innerHTML = r.messages
    .map(
      (m) => `<div class="msg ${m.from_me ? "me" : ""}">${m.text}<div class="small">${new Date(m.time * 1000).toLocaleTimeString("ru-RU")}</div></div>`
    )
    .join("");
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  const input = $("#msgInput");
  const params = new URLSearchParams(location.search);
  const chat = params.get("chat");
  if (!chat || !input.value.trim()) return;
  await api("/api/messages.php?action=send", { method: "POST", body: JSON.stringify({ to_id: Number(chat), text: input.value.trim() }) });
  input.value = "";
  loadMessages();
  loadChats();
}
window.sendMessage = sendMessage;

async function loadDevUsers() {
  const wrap = $("#devUsers");
  if (!wrap) return;
  const r = await api("/api/user.php?action=all");
  if (!r.ok) return;
  wrap.innerHTML = r.users
    .map(
      (u) => `<div class="user-row"><div class="row"><img class="avatar sm" src="${u.avatar}"><div><b>${u.username}</b> ${badgeHtml(u.role)}<div class="small">ID ${u.id}</div></div></div><div class="popup"><button class="dots">⋯</button><div class="popup-menu"><button class="btn" onclick="userAction(${u.id},'ban')">Бан</button><button class="btn" onclick="userAction(${u.id},'rename')">Сменить имя</button><button class="btn" onclick="userAction(${u.id},'change_id')">Сменить ID</button><button class="btn" onclick="userAction(${u.id},'freeze')">Заморозить</button></div></div></div>`
    )
    .join("");

  $$(".popup .dots").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      b.parentElement.classList.toggle("open");
    })
  );
  document.addEventListener("click", () => $$(".popup").forEach((p) => p.classList.remove("open")));
}

window.userAction = async (id, action) => {
  let payload = { target_id: id, action };
  if (action === "rename") payload.value = prompt("Новое имя:") || "";
  if (action === "freeze") payload.value = Number(prompt("Время заморозки в минутах:") || 0);
  await api("/api/user.php?action=moderate", { method: "POST", body: JSON.stringify(payload) });
  loadDevUsers();
};

async function pollNotifications() {
  const r = await api("/api/messages.php?action=inbox");
  if (r.ok && r.notifications && r.notifications.length) {
    const n = r.notifications[0];
    showNotice(`<div class="row"><img class="avatar sm" src="${n.avatar}"><div><b>${n.username}</b><div>${n.text}</div></div></div>`);
  }
}

async function saveNick() {
  const nick = $("#newNick").value.trim();
  const r = await api("/api/user.php?action=change_nick", { method: "POST", body: JSON.stringify({ username: nick }) });
  alert(r.message);
  if (r.ok) loadMe();
}
window.saveNick = saveNick;

document.addEventListener("DOMContentLoaded", async () => {
  await loadMe();
  await loadFeed();
  await loadFriends();
  await loadChats();
  await loadMessages();
  await loadDevUsers();
  setInterval(pollNotifications, 9000);
});

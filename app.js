const BACKEND_URL = 'http://127.0.0.1:3030';
const DEBOUNCE_MS = 320;
const FALLBACK_POSTER = 'https://placehold.co/220x330/0f172a/cbd5e1?text=No+Poster';

const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('results');
const statusEl = document.getElementById('status');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const tabs = document.querySelectorAll('.tab-btn');
const tabViews = document.querySelectorAll('.tab-view');
const favoritesList = document.getElementById('favoritesList');
const favoritesCount = document.getElementById('favoritesCount');
const notesList = document.getElementById('notesList');
const newNoteBtn = document.getElementById('newNoteBtn');
const noteTemplate = document.getElementById('noteTemplate');
const detailsOverlay = document.getElementById('detailsOverlay');
const detailsModal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const movieDetails = document.getElementById('movieDetails');

let debounceTimer = null;
let currentKeyword = '';
let currentPage = 1;
let totalPages = 0;
let isLoading = false;
let requestSerial = 0;
let favoritesMap = new Map();

const AVATARS = ['🎬', '👤', '🔥'];
const NICKS = ['MovieFan', 'Alex', 'User123', 'CinemaLover', 'FilmGeek'];

function setStatus(text) {
  statusEl.textContent = text;
}

function normalizeFilm(rawFilm) {
  return {
    id: Number.isInteger(rawFilm?.id) ? rawFilm.id : null,
    title: rawFilm?.name || rawFilm?.alternativeName || 'Без названия',
    year: rawFilm?.year ? String(rawFilm.year).trim() : '—',
    poster: rawFilm?.poster?.url || FALLBACK_POSTER,
    description: (rawFilm?.description || '').trim() || 'Нет описания',
    rating: Number.isFinite(rawFilm?.rating?.kp) ? rawFilm.rating.kp.toFixed(1) : '—',
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Ошибка API: ${response.status}`);
  }

  return payload;
}

function openInApp(id) {
  if (!id) return;
  window.electronAPI?.openMovie?.(id);
}

function openInBrowser(id) {
  if (!id) return;
  window.electronAPI?.openExternalUrl?.(`https://www.kinopoisk.net/film/${id}/`);
}

function buildWatchButtons(id) {
  const wrap = document.createElement('div');
  wrap.className = 'film-action';

  const appBtn = document.createElement('button');
  appBtn.className = 'watch-btn primary';
  appBtn.type = 'button';
  appBtn.textContent = '▶ Смотреть в приложении';
  appBtn.disabled = !id;
  appBtn.addEventListener('click', () => openInApp(id));

  const webBtn = document.createElement('button');
  webBtn.className = 'watch-btn secondary';
  webBtn.type = 'button';
  webBtn.textContent = '🌐 Смотреть в браузере';
  webBtn.disabled = !id;
  webBtn.addEventListener('click', () => openInBrowser(id));

  wrap.append(appBtn, webBtn);
  return wrap;
}

function createFilmCard(film, { inFavorites = false } = {}) {
  const li = document.createElement('li');
  li.className = 'result-item fade-in';

  const poster = document.createElement('img');
  poster.className = 'film-poster';
  poster.src = film.poster || FALLBACK_POSTER;
  poster.alt = `${film.title} poster`;
  poster.loading = 'lazy';

  const info = document.createElement('div');
  info.className = 'film-meta';

  const title = document.createElement('button');
  title.className = 'link-title';
  title.type = 'button';
  title.textContent = film.title;
  title.disabled = !film.id;
  title.addEventListener('click', () => openMovieDetails(film.id));

  const meta = document.createElement('div');
  meta.className = 'film-grid';
  meta.innerHTML = `<span>Год: ${film.year}</span><span>ID: ${film.id ?? '—'}</span><span>Рейтинг: ${film.rating}</span>`;

  const desc = document.createElement('p');
  desc.className = 'film-description';
  desc.textContent = film.description;

  const controls = document.createElement('div');
  controls.className = 'film-controls';

  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className = 'watch-btn ghost';
  detailsBtn.textContent = 'Подробнее';
  detailsBtn.disabled = !film.id;
  detailsBtn.addEventListener('click', () => openMovieDetails(film.id));

  const favBtn = document.createElement('button');
  favBtn.type = 'button';
  if (inFavorites) {
    favBtn.className = 'watch-btn danger';
    favBtn.textContent = 'Удалить из избранного';
    favBtn.addEventListener('click', () => removeFavorite(film.id));
  } else {
    favBtn.className = 'watch-btn accent';
    favBtn.textContent = favoritesMap.has(film.id) ? '⭐ В избранном' : '⭐ В избранное';
    favBtn.disabled = !film.id;
    favBtn.addEventListener('click', () => addFavorite(film));
  }

  controls.append(detailsBtn, favBtn);

  info.append(title, meta, desc, buildWatchButtons(film.id), controls);
  li.append(poster, info);

  return li;
}

function renderSearchResults(items, append = false) {
  if (!append) resultsList.innerHTML = '';

  if (!items.length && !append) {
    setStatus('Ничего не найдено.');
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((item) => frag.appendChild(createFilmCard(item)));
  resultsList.appendChild(frag);
}

function updateLoadMore() {
  loadMoreBtn.classList.toggle('hidden', !(currentKeyword && currentPage < totalPages && !isLoading));
}

async function searchFilms(keyword, page = 1, append = false) {
  if (!keyword.trim()) {
    resultsList.innerHTML = '';
    currentPage = 1;
    totalPages = 0;
    setStatus('Введите название');
    updateLoadMore();
    return;
  }

  const requestId = ++requestSerial;
  isLoading = true;
  setStatus('Ищем фильмы…');
  updateLoadMore();

  try {
    const data = await api(`/search?q=${encodeURIComponent(keyword)}&page=${page}`);
    if (requestId !== requestSerial) return;

    const docs = Array.isArray(data?.docs) ? data.docs : [];
    currentPage = page;
    totalPages = Number.isFinite(data?.pages) ? data.pages : page;

    const normalized = docs.map(normalizeFilm);
    renderSearchResults(normalized, append);

    setStatus(normalized.length ? `Найдено: ${normalized.length}` : 'Ничего не найдено.');
  } catch (error) {
    if (requestId !== requestSerial) return;
    setStatus(error.message || 'Ошибка запроса.');
    if (!append) resultsList.innerHTML = '';
  } finally {
    if (requestId === requestSerial) {
      isLoading = false;
      updateLoadMore();
    }
  }
}

async function loadFavorites() {
  const data = await api('/favorites');
  const items = Array.isArray(data?.items) ? data.items : [];
  favoritesMap = new Map(items.map((item) => [item.id, item]));
  renderFavorites();
}

function renderFavorites() {
  favoritesList.innerHTML = '';
  const items = Array.from(favoritesMap.values());
  favoritesCount.textContent = `${items.length} фильмов`;

  if (!items.length) {
    favoritesList.innerHTML = '<p class="empty-text">Пока пусто. Добавьте фильмы в избранное.</p>';
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((film) => frag.appendChild(createFilmCard(film, { inFavorites: true })));
  favoritesList.appendChild(frag);
}

async function addFavorite(film) {
  if (!film?.id) return;
  await api('/favorites', {
    method: 'POST',
    body: JSON.stringify(film),
  });
  await loadFavorites();
}

async function removeFavorite(id) {
  if (!id) return;
  await api(`/favorites/${id}`, { method: 'DELETE' });
  await loadFavorites();
}

function renderNoteCard(note) {
  const node = noteTemplate.content.firstElementChild.cloneNode(true);
  const title = node.querySelector('.note-title');
  const content = node.querySelector('.note-content');
  const date = node.querySelector('.note-date');

  title.value = note.title || '';
  content.value = note.content || '';
  date.textContent = note.updatedAt ? `Обновлено: ${new Date(note.updatedAt).toLocaleString()}` : '';

  node.querySelector('.save-note').addEventListener('click', async () => {
    await api(`/notes/${note.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: title.value, content: content.value }),
    });
    await loadNotes();
  });

  node.querySelector('.delete-note').addEventListener('click', async () => {
    await api(`/notes/${note.id}`, { method: 'DELETE' });
    await loadNotes();
  });

  return node;
}

async function loadNotes() {
  const data = await api('/notes');
  const notes = Array.isArray(data?.items) ? data.items : [];
  notesList.innerHTML = '';

  if (!notes.length) {
    notesList.innerHTML = '<p class="empty-text">Нет заметок. Создайте первую.</p>';
    return;
  }

  const frag = document.createDocumentFragment();
  notes.forEach((note) => frag.appendChild(renderNoteCard(note)));
  notesList.appendChild(frag);
}

function renderCommentCard(comment, index) {
  const article = document.createElement('article');
  article.className = 'comment-item';

  const avatar = document.createElement('div');
  avatar.className = 'comment-avatar';
  avatar.textContent = AVATARS[index % AVATARS.length];

  const body = document.createElement('div');
  body.className = 'comment-body';

  const name = document.createElement('div');
  name.className = 'comment-name';
  name.textContent = comment.author || NICKS[index % NICKS.length];

  const text = document.createElement('p');
  text.className = 'comment-text';
  text.textContent = comment.text || 'Нет текста';

  body.append(name, text);
  article.append(avatar, body);

  return article;
}

function openModal() {
  detailsOverlay.classList.remove('hidden');
}

function closeModal() {
  detailsOverlay.classList.add('hidden');
  movieDetails.innerHTML = '';
}

async function resolveTrailerEmbed(data) {
  if (data?.trailerUrl?.includes('/embed/')) {
    return data.trailerUrl;
  }

  if (data?.trailerUrl) {
    const fromUrl = data.trailerUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (fromUrl) return `https://www.youtube.com/embed/${fromUrl[1]}`;
  }

  try {
    const found = await api(`/trailer?title=${encodeURIComponent(data?.name || '')}`);
    return found?.trailerEmbed || '';
  } catch {
    return '';
  }
}

async function openMovieDetails(id) {
  if (!id) return;

  openModal();
  movieDetails.innerHTML = '<p class="status">Загружаем подробности…</p>';

  try {
    const data = await api(`/movie/${id}/details`);
    const trailerEmbed = await resolveTrailerEmbed(data);

    movieDetails.innerHTML = `
      <div class="details-head">
        <img class="details-poster" src="${data.poster || FALLBACK_POSTER}" alt="${data.name}" />
        <div class="details-meta">
          <h2>${data.name || 'Без названия'}</h2>
          <p>${data.description || 'Нет описания'}</p>
          <div class="chips">
            <span class="chip">Год: ${data.year || '—'}</span>
            <span class="chip">Рейтинг: ${data.rating || '—'}</span>
            <span class="chip">Жанры: ${(data.genres || []).join(', ') || '—'}</span>
          </div>
          <p><strong>Режиссёр:</strong> ${data.director || '—'}</p>
          <p><strong>Актёры:</strong> ${(data.actors || []).join(', ') || '—'}</p>
          <div class="adguard-block">
            <span>Для просмотра без рекламы рекомендуется установить AdGuard</span>
            <button id="adguardBtn" class="watch-btn secondary" type="button">Скачать AdGuard</button>
          </div>
          ${buildWatchButtons(data.id).outerHTML}
        </div>
      </div>

      <div class="trailer-wrap">
        <h3>Трейлер</h3>
        ${trailerEmbed
          ? `<iframe class="movie-player" src="${trailerEmbed}" title="Трейлер" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
          : '<p class="empty-text">Трейлер не найден</p>'}
      </div>

      <div>
        <h3>Комментарии (только чтение)</h3>
        <div id="commentsList" class="comments-list"></div>
      </div>
    `;

    const adguardBtn = document.getElementById('adguardBtn');
    adguardBtn?.addEventListener('click', () => window.electronAPI?.openExternalUrl?.('https://adguard.com'));

    const detailsButtons = movieDetails.querySelectorAll('.film-action .watch-btn');
    detailsButtons[0]?.addEventListener('click', () => openInApp(data.id));
    detailsButtons[1]?.addEventListener('click', () => openInBrowser(data.id));

    const commentsNode = document.getElementById('commentsList');
    const comments = Array.isArray(data.comments) ? data.comments : [];
    if (!comments.length) {
      commentsNode.innerHTML = '<p class="empty-text">Комментарии пока недоступны.</p>';
    } else {
      const frag = document.createDocumentFragment();
      comments.slice(0, 8).forEach((comment, index) => frag.appendChild(renderCommentCard(comment, index)));
      commentsNode.appendChild(frag);
    }
  } catch (error) {
    movieDetails.innerHTML = `<p class="status">${error.message || 'Ошибка загрузки фильма.'}</p>`;
  }
}

function activateTab(tabName) {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabName));
  tabViews.forEach((view) => view.classList.toggle('active', view.id === `tab-${tabName}`));
}

searchInput.addEventListener('input', () => {
  currentKeyword = (searchInput.value || '').trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => searchFilms(currentKeyword, 1, false), DEBOUNCE_MS);
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    clearTimeout(debounceTimer);
    currentKeyword = (searchInput.value || '').trim();
    searchFilms(currentKeyword, 1, false);
  }
});

loadMoreBtn.addEventListener('click', () => {
  if (isLoading || currentPage >= totalPages) return;
  searchFilms(currentKeyword, currentPage + 1, true);
});

newNoteBtn.addEventListener('click', async () => {
  await api('/notes', {
    method: 'POST',
    body: JSON.stringify({ title: 'Новая заметка', content: '' }),
  });
  await loadNotes();
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
});

closeModalBtn.addEventListener('click', closeModal);
detailsOverlay.addEventListener('click', (event) => {
  if (event.target === detailsOverlay) closeModal();
});
detailsModal.addEventListener('click', (event) => event.stopPropagation());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !detailsOverlay.classList.contains('hidden')) {
    closeModal();
  }
});

Promise.all([loadFavorites(), loadNotes()]).catch((error) => {
  setStatus(error.message || 'Ошибка загрузки локальных данных.');
});

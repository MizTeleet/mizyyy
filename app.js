const BACKEND_URL = 'http://127.0.0.1:3030';
const DEBOUNCE_MS = 300;
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
const movieDetails = document.getElementById('movieDetails');

let debounceTimer = null;
let currentKeyword = '';
let currentPage = 1;
let totalPages = 0;
let isLoading = false;
let requestSerial = 0;
let favoritesMap = new Map();

function setStatus(text) {
  statusEl.textContent = text;
}

function cleanText(value, fallback = '—') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function normalizeFilm(rawFilm) {
  return {
    id: Number.isInteger(rawFilm?.id) ? rawFilm.id : null,
    title: rawFilm?.name || rawFilm?.alternativeName || 'Без названия',
    year: rawFilm?.year ? String(rawFilm.year).trim() : '—',
    poster: rawFilm?.poster?.url || FALLBACK_POSTER,
    description: cleanText(rawFilm?.description, 'Нет описания'),
    rating: Number.isFinite(rawFilm?.rating?.kp) ? rawFilm.rating.kp.toFixed(1) : '—',
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Ошибка API: ${response.status}`);
  return payload;
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

  const titleBtn = document.createElement('button');
  titleBtn.className = 'link-title';
  titleBtn.type = 'button';
  titleBtn.textContent = film.title;
  titleBtn.disabled = !film.id;
  titleBtn.addEventListener('click', () => openMovieDetails(film.id));

  const meta = document.createElement('div');
  meta.className = 'film-grid';
  meta.innerHTML = `<span>Год: ${film.year}</span><span>ID: ${film.id ?? '—'}</span><span>Рейтинг КП: ${film.rating}</span>`;

  const desc = document.createElement('p');
  desc.className = 'film-description';
  desc.textContent = film.description;

  const actions = document.createElement('div');
  actions.className = 'film-action';

  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className = 'watch-btn primary';
  detailsBtn.textContent = 'Подробнее';
  detailsBtn.disabled = !film.id;
  detailsBtn.addEventListener('click', () => openMovieDetails(film.id));
  actions.appendChild(detailsBtn);

  const favBtn = document.createElement('button');
  favBtn.type = 'button';

  if (inFavorites) {
    favBtn.className = 'watch-btn danger';
    favBtn.textContent = 'Удалить из избранного';
    favBtn.addEventListener('click', () => removeFavorite(film.id));
  } else {
    favBtn.className = 'watch-btn secondary';
    favBtn.textContent = favoritesMap.has(film.id) ? '⭐ В избранном' : '⭐ В избранное';
    favBtn.disabled = !film.id;
    favBtn.addEventListener('click', () => addFavorite(film));
  }

  actions.appendChild(favBtn);
  info.append(titleBtn, meta, desc, actions);
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
  const show = currentKeyword && currentPage < totalPages && !isLoading;
  loadMoreBtn.classList.toggle('hidden', !show);
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

  const reqId = ++requestSerial;
  isLoading = true;
  setStatus('Ищем фильмы…');
  updateLoadMore();

  try {
    const data = await api(`/search?q=${encodeURIComponent(keyword)}&page=${page}`);
    if (reqId !== requestSerial) return;

    const docs = Array.isArray(data?.docs) ? data.docs : [];
    currentPage = page;
    totalPages = Number.isFinite(data?.pages) ? data.pages : page;

    const normalized = docs.map(normalizeFilm);
    renderSearchResults(normalized, append);

    if (normalized.length) {
      setStatus(`Найдено: ${normalized.length} на странице ${currentPage}${totalPages ? ` из ${totalPages}` : ''}.`);
    } else if (!append) {
      setStatus('Ничего не найдено.');
    }
  } catch (error) {
    if (reqId !== requestSerial) return;
    setStatus(error.message || 'Не удалось выполнить запрос.');
    if (!append) resultsList.innerHTML = '';
  } finally {
    if (reqId === requestSerial) {
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
    const p = document.createElement('p');
    p.className = 'empty-text';
    p.textContent = 'Пока пусто. Добавьте фильмы в избранное.';
    favoritesList.appendChild(p);
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((item) => frag.appendChild(createFilmCard(item, { inFavorites: true })));
  favoritesList.appendChild(frag);
}

async function addFavorite(film) {
  if (!film?.id) return;
  await api('/favorites', {
    method: 'POST',
    body: JSON.stringify({
      id: film.id,
      title: film.title,
      year: film.year,
      poster: film.poster,
      rating: film.rating,
      description: film.description,
    }),
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
    const p = document.createElement('p');
    p.className = 'empty-text';
    p.textContent = 'Нет заметок. Создайте первую.';
    notesList.appendChild(p);
    return;
  }

  const frag = document.createDocumentFragment();
  notes.forEach((note) => frag.appendChild(renderNoteCard(note)));
  notesList.appendChild(frag);
}

function getYoutubeEmbed(urlString) {
  if (!urlString) return '';
  try {
    const url = new URL(urlString);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
  } catch {
    return '';
  }
  return '';
}

function sanitizeNoTelegram(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/telegram|t\.me|tg/gi, '').trim();
}

async function openMovieDetails(id) {
  if (!id) return;

  movieDetails.classList.remove('hidden');
  movieDetails.innerHTML = '<p class="status">Загружаем страницу фильма…</p>';

  try {
    const data = await api(`/movie/${id}/details`);
    const trailerSrc = getYoutubeEmbed(data.trailerUrl);
    const genres = data.genres?.length ? data.genres.join(', ') : '—';
    const actors = data.actors?.length ? data.actors.join(', ') : '—';

    movieDetails.innerHTML = `
      <div class="details-head">
        <img class="details-poster" src="${data.poster || FALLBACK_POSTER}" alt="${data.name}" />
        <div class="details-meta">
          <h2>${cleanText(data.name, 'Без названия')}</h2>
          <p>${sanitizeNoTelegram(cleanText(data.description, 'Нет описания'))}</p>
          <div class="chips">
            <span class="chip">Год: ${data.year || '—'}</span>
            <span class="chip">Рейтинг: ${data.rating || '—'}</span>
            <span class="chip">Жанры: ${genres}</span>
          </div>
          <p><strong>Режиссёр:</strong> ${cleanText(data.director, '—')}</p>
          <p><strong>Актёры:</strong> ${sanitizeNoTelegram(actors)}</p>
          <div class="adguard-block">
            <span>Для просмотра без рекламы рекомендуется установить AdGuard</span>
            <button id="adguardBtn" type="button" class="watch-btn secondary">Скачать AdGuard</button>
          </div>
        </div>
      </div>
      <div class="trailer-wrap">
        <h3>Трейлер</h3>
        ${trailerSrc
          ? `<iframe src="${trailerSrc}" title="Трейлер" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
          : '<p class="empty-text">Трейлер не найден.</p>'}
      </div>
      <div>
        <h3>Комментарии (только чтение)</h3>
        <div class="comments-list">
          ${(data.comments || []).length
            ? data.comments.slice(0, 6).map((c) => `
              <article class="comment">
                <h4>${cleanText(c.title, 'Комментарий')}</h4>
                <p>${sanitizeNoTelegram(cleanText(c.text, 'Нет текста'))}</p>
                <span>${cleanText(c.author, 'Пользователь')}</span>
              </article>
            `).join('')
            : '<p class="empty-text">Комментарии пока недоступны.</p>'}
        </div>
      </div>
    `;

    document.getElementById('adguardBtn')?.addEventListener('click', () => {
      window.electronAPI?.openExternalUrl?.('https://adguard.com');
    });

    movieDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    movieDetails.innerHTML = `<p class="status">${error.message || 'Ошибка загрузки фильма.'}</p>`;
  }
}

function activateTab(tab) {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  tabViews.forEach((view) => view.classList.toggle('active', view.id === `tab-${tab}`));
}

function triggerSearchNow() {
  clearTimeout(debounceTimer);
  currentKeyword = (searchInput.value || '').trim();
  searchFilms(currentKeyword, 1, false);
}

searchInput.addEventListener('input', () => {
  currentKeyword = (searchInput.value || '').trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => searchFilms(currentKeyword, 1, false), DEBOUNCE_MS);
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    triggerSearchNow();
  }
});

loadMoreBtn.addEventListener('click', () => {
  if (isLoading || currentPage >= totalPages) return;
  searchFilms(currentKeyword, currentPage + 1, true);
});

newNoteBtn.addEventListener('click', async () => {
  await api('/notes', { method: 'POST', body: JSON.stringify({ title: 'Новая заметка', content: '' }) });
  await loadNotes();
});

tabs.forEach((t) => {
  t.addEventListener('click', () => activateTab(t.dataset.tab));
});

Promise.all([loadFavorites(), loadNotes()]).catch((error) => {
  setStatus(error.message || 'Ошибка загрузки локальных данных.');
});

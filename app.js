const BACKEND_URL = 'http://127.0.0.1:3030';
const DEBOUNCE_MS = 400;
const FALLBACK_POSTER = 'https://placehold.co/120x180/0f172a/9ca3af?text=No+Poster';

const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('results');
const statusEl = document.getElementById('status');
const loadMoreBtn = document.getElementById('loadMoreBtn');

let debounceTimer = null;
let currentKeyword = '';
let currentPage = 1;
let totalPages = 0;
let isLoading = false;
let requestSerial = 0;

function setStatus(text) {
  statusEl.textContent = text;
}

function normalizeFilm(rawFilm) {
  const id = Number.isInteger(rawFilm?.id) ? rawFilm.id : null;
  const title = rawFilm?.name || rawFilm?.alternativeName || 'Без названия';
  const year = rawFilm?.year ? String(rawFilm.year).trim() : '—';
  const poster = rawFilm?.poster?.url || FALLBACK_POSTER;
  const description = (rawFilm?.description || '').trim() || 'Нет описания';
  const rating = Number.isFinite(rawFilm?.rating?.kp) ? rawFilm.rating.kp.toFixed(1) : '—';

  return { id, title, year, poster, description, rating };
}

function renderFilms(films, append = false) {
  if (!append) {
    resultsList.innerHTML = '';
  }

  if (!films.length && !append) {
    setStatus('Ничего не найдено.');
    return;
  }

  const fragment = document.createDocumentFragment();

  films.forEach((film) => {
    const li = document.createElement('li');
    li.className = 'result-item';

    const poster = document.createElement('img');
    poster.className = 'film-poster';
    poster.src = film.poster;
    poster.alt = `${film.title} poster`;
    poster.loading = 'lazy';

    const info = document.createElement('div');
    info.className = 'film-meta';

    const title = document.createElement('span');
    title.className = 'film-title';
    title.textContent = film.title;

    const year = document.createElement('span');
    year.className = 'film-sub';
    year.textContent = `Год: ${film.year}`;

    const id = document.createElement('span');
    id.className = 'film-sub';
    id.textContent = `ID: ${film.id ?? '—'}`;

    const rating = document.createElement('span');
    rating.className = 'film-sub';
    rating.textContent = `Рейтинг КП: ${film.rating}`;

    const description = document.createElement('p');
    description.className = 'film-description';
    description.textContent = film.description;

    info.append(title, year, id, rating, description);

    const action = document.createElement('div');
    action.className = 'film-action';

    const inAppBtn = document.createElement('button');
    inAppBtn.type = 'button';
    inAppBtn.className = 'watch-btn in-app-btn';
    inAppBtn.textContent = '🎬 Смотреть в приложении';

    const browserBtn = document.createElement('button');
    browserBtn.type = 'button';
    browserBtn.className = 'watch-btn browser-btn';
    browserBtn.textContent = '🌐 Смотреть без рекламы';

    if (typeof film.id === 'number' && window.electronAPI?.openMovie && window.electronAPI?.openMovieExternal) {
      inAppBtn.addEventListener('click', () => {
        window.electronAPI.openMovie(film.id);
      });

      browserBtn.addEventListener('click', () => {
        window.electronAPI.openMovieExternal(film.id);
      });
    } else {
      inAppBtn.disabled = true;
      browserBtn.disabled = true;
      inAppBtn.title = 'Ссылка недоступна: отсутствует ID фильма';
      browserBtn.title = 'Ссылка недоступна: отсутствует ID фильма';
    }

    action.append(inAppBtn, browserBtn);
    li.append(poster, info, action);
    fragment.appendChild(li);
  });

  resultsList.appendChild(fragment);
}

function updateLoadMoreVisibility() {
  if (currentKeyword && currentPage < totalPages && !isLoading) {
    loadMoreBtn.classList.remove('hidden');
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

async function fetchFilms(keyword, page = 1, append = false) {
  if (!keyword.trim()) {
    resultsList.innerHTML = '';
    currentPage = 1;
    totalPages = 0;
    setStatus('Введите название фильма для поиска.');
    updateLoadMoreVisibility();
    return;
  }

  const mySerial = ++requestSerial;
  isLoading = true;
  updateLoadMoreVisibility();
  setStatus('Ищем фильмы…');

  try {
    const url = new URL('/search', BACKEND_URL);
    url.searchParams.set('q', keyword);
    url.searchParams.set('page', String(page));

    const response = await fetch(url.toString(), { method: 'GET' });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || `Ошибка API: ${response.status}`);
    }

    if (mySerial !== requestSerial) {
      return;
    }

    const items = Array.isArray(payload?.docs) ? payload.docs : [];
    totalPages = Number.isFinite(payload?.pages) ? payload.pages : page;
    currentPage = page;

    const normalized = items.map(normalizeFilm);
    renderFilms(normalized, append);

    if (normalized.length) {
      setStatus(`Найдено: ${normalized.length} на странице ${currentPage}${totalPages ? ` из ${totalPages}` : ''}.`);
    } else if (!append) {
      setStatus('Ничего не найдено.');
    }

    updateLoadMoreVisibility();
  } catch (error) {
    if (mySerial !== requestSerial) {
      return;
    }

    setStatus(error.message || 'Не удалось выполнить запрос.');
    if (!append) {
      resultsList.innerHTML = '';
    }
    updateLoadMoreVisibility();
  } finally {
    if (mySerial === requestSerial) {
      isLoading = false;
      updateLoadMoreVisibility();
    }
  }
}

function triggerSearchNow() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  currentKeyword = (searchInput.value || '').trim();
  fetchFilms(currentKeyword, 1, false);
}

function handleInput() {
  currentKeyword = (searchInput.value || '').trim();

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    fetchFilms(currentKeyword, 1, false);
  }, DEBOUNCE_MS);
}

searchInput.addEventListener('input', handleInput);

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    triggerSearchNow();
  }
});

loadMoreBtn.addEventListener('click', () => {
  if (isLoading || currentPage >= totalPages) {
    return;
  }

  fetchFilms(currentKeyword, currentPage + 1, true);
});

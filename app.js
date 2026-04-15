const API_KEY = '7P5F36A-AQ44G61-JTW1QJN-E7R8YXZ';
const API_URL = 'https://api.kinopoisk.dev/v1.4/movie/search';

const REQUEST_DELAY_MS = 250;
const DEBOUNCE_MS = 400;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setStatus(text) {
  statusEl.textContent = text;
}

function normalizeFilm(rawFilm) {
  const id = Number.isInteger(rawFilm?.id) ? rawFilm.id : null;
  const title = rawFilm?.name || rawFilm?.alternativeName || 'Без названия';

  let year = '—';
  if (rawFilm?.year && String(rawFilm.year).trim()) {
    year = String(rawFilm.year).trim();
  }

  return {
    id,
    title,
    year,
  };
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

    const filmId = film.id ?? '—';
    const safeLink = typeof film.id === 'number' ? `https://www.kinopoisk.net/film/${film.id}/` : null;

    const meta = document.createElement('div');
    meta.className = 'film-meta';

    const title = document.createElement('span');
    title.className = 'film-title';
    title.textContent = film.title;

    const year = document.createElement('span');
    year.className = 'film-sub';
    year.textContent = `Год: ${film.year}`;

    const id = document.createElement('span');
    id.className = 'film-sub';
    id.textContent = `ID: ${filmId}`;

    meta.append(title, year, id);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'watch-btn';
    btn.textContent = 'Смотреть';

    if (safeLink) {
      btn.addEventListener('click', () => {
        window.open(safeLink, '_blank', 'noopener,noreferrer');
      });
    } else {
      btn.disabled = true;
      btn.title = 'Ссылка недоступна: отсутствует ID фильма';
    }

    li.append(meta, btn);
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

async function parseApiError(response) {
  try {
    const payload = await response.json();
    const message = payload?.message || payload?.error || payload?.statusText;
    if (message) {
      return `Ошибка API: ${message}`;
    }
  } catch (_ignored) {
    // noop
  }

  return `Ошибка API: ${response.status}`;
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

  isLoading = true;
  updateLoadMoreVisibility();
  setStatus('Ищем фильмы…');

  const mySerial = ++requestSerial;

  try {
    await sleep(REQUEST_DELAY_MS);

    const url = new URL(API_URL);
    url.searchParams.set('query', keyword);
    url.searchParams.set('page', String(page));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-KEY': API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    const data = await response.json();

    if (mySerial !== requestSerial) {
      return;
    }

    const items = Array.isArray(data?.docs) ? data.docs : [];
    totalPages = Number.isFinite(data?.pages) ? data.pages : page;
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

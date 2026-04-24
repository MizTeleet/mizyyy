const http = require('http');
const path = require('path');
const fs = require('fs/promises');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3030);
const API_KEY = process.env.API_KEY || '7P5F36A-AQ44G61-JTW1QJN-E7R8YXZ';
const API_BASE = 'https://api.kinopoisk.dev/v1.4';
const DATA_DIR = process.env.LEETFILMS_DATA_DIR || path.join(process.cwd(), 'LeetFilmsData');

const FILES = {
  favorites: path.join(DATA_DIR, 'favorites.json'),
  user: path.join(DATA_DIR, 'user.json'),
  notes: path.join(DATA_DIR, 'notes.json'),
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function errText(error) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const defaults = {
    [FILES.favorites]: '[]\n',
    [FILES.user]: '{"name":"","createdAt":""}\n',
    [FILES.notes]: '[]\n',
  };

  await Promise.all(
    Object.entries(defaults).map(async ([f, v]) => {
      try {
        await fs.access(f);
      } catch {
        await fs.writeFile(f, v, 'utf8');
      }
    }),
  );
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Слишком большой body'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        return resolve(JSON.parse(body));
      } catch {
        return reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function kp(pathname, params = {}) {
  const url = new URL(`${API_BASE}${pathname}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  const res = await fetch(url.toString(), {
    headers: { 'X-API-KEY': API_KEY },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || `Ошибка API: ${res.status}`);
  return data;
}

async function handleMovieDetails(id, res) {
  try {
    const [movie, reviews] = await Promise.all([
      kp(`/movie/${id}`),
      kp('/review', { movieId: id, page: 1, limit: 10 }).catch(() => ({ docs: [] })),
    ]);

    const persons = Array.isArray(movie?.persons) ? movie.persons : [];
    const actors = persons
      .filter((p) => p?.profession === 'актеры' || p?.enProfession === 'actor')
      .slice(0, 8)
      .map((p) => p?.name || p?.enName)
      .filter(Boolean);
    const director = persons.find((p) => p?.profession === 'режиссеры' || p?.enProfession === 'director');

    const trailer = (movie?.videos?.trailers || []).find((t) => /youtube\.com|youtu\.be/i.test(t?.url || ''));

    const comments = (reviews?.docs || [])
      .map((r) => ({
        id: r?.id,
        title: r?.title || 'Комментарий',
        author: r?.author || 'Пользователь',
        text: r?.review || r?.reviewDislikes || r?.reviewLikes || '',
      }))
      .filter((r) => r.text);

    return sendJson(res, 200, {
      id: movie?.id || id,
      name: movie?.name || movie?.alternativeName || 'Без названия',
      year: movie?.year || '—',
      description: (movie?.description || '').trim() || 'Нет описания',
      rating: Number.isFinite(movie?.rating?.kp) ? movie.rating.kp.toFixed(1) : '—',
      poster: movie?.poster?.url || '',
      genres: (movie?.genres || []).map((g) => g?.name).filter(Boolean),
      actors,
      director: director?.name || director?.enName || '—',
      trailerUrl: trailer?.url || '',
      comments,
    });
  } catch (error) {
    return sendJson(res, 502, { error: errText(error) });
  }
}

async function handleFavorites(req, res, pathname) {
  const favorites = await readJson(FILES.favorites, []);

  if (req.method === 'GET' && pathname === '/favorites') {
    return sendJson(res, 200, { items: favorites });
  }

  if (req.method === 'POST' && pathname === '/favorites') {
    const body = await parseBody(req);
    const id = Number(body?.id);
    if (!Number.isInteger(id)) return sendJson(res, 400, { error: 'Некорректный id' });

    if (favorites.some((f) => f.id === id)) return sendJson(res, 200, { items: favorites });

    const next = [{
      id,
      title: body?.title || 'Без названия',
      year: body?.year || '—',
      poster: body?.poster || '',
      rating: body?.rating || '—',
      description: body?.description || 'Нет описания',
    }, ...favorites];

    await writeJson(FILES.favorites, next);
    return sendJson(res, 201, { items: next });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/favorites/')) {
    const id = Number(pathname.split('/').pop());
    const next = favorites.filter((f) => f.id !== id);
    await writeJson(FILES.favorites, next);
    return sendJson(res, 200, { items: next });
  }

  return null;
}

async function handleNotes(req, res, pathname) {
  const notes = await readJson(FILES.notes, []);

  if (req.method === 'GET' && pathname === '/notes') {
    return sendJson(res, 200, { items: notes });
  }

  if (req.method === 'POST' && pathname === '/notes') {
    const body = await parseBody(req);
    const next = [{
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      title: (body?.title || 'Без названия').trim(),
      content: (body?.content || '').trim(),
      updatedAt: new Date().toISOString(),
    }, ...notes];

    await writeJson(FILES.notes, next);
    return sendJson(res, 201, { items: next });
  }

  if (req.method === 'PUT' && pathname.startsWith('/notes/')) {
    const id = pathname.split('/').pop();
    const body = await parseBody(req);
    const next = notes.map((n) => n.id === id ? {
      ...n,
      title: (body?.title || n.title || 'Без названия').trim(),
      content: (body?.content || '').trim(),
      updatedAt: new Date().toISOString(),
    } : n);
    await writeJson(FILES.notes, next);
    return sendJson(res, 200, { items: next });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/notes/')) {
    const id = pathname.split('/').pop();
    const next = notes.filter((n) => n.id !== id);
    await writeJson(FILES.notes, next);
    return sendJson(res, 200, { items: next });
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${PORT}`}`);

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  try {
    if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true });

    if (req.method === 'GET' && url.pathname === '/search') {
      const q = (url.searchParams.get('q') || '').trim();
      const page = (url.searchParams.get('page') || '1').trim();
      if (!q) return sendJson(res, 400, { error: 'Параметр q обязателен' });

      try {
        const data = await kp('/movie/search', { query: q, page });
        return sendJson(res, 200, data);
      } catch (error) {
        return sendJson(res, 502, { error: errText(error) });
      }
    }

    if (req.method === 'GET' && /^\/movie\/\d+\/details$/.test(url.pathname)) {
      const id = Number(url.pathname.split('/')[2]);
      return handleMovieDetails(id, res);
    }

    const fav = await handleFavorites(req, res, url.pathname);
    if (fav !== null) return fav;

    const notes = await handleNotes(req, res, url.pathname);
    if (notes !== null) return notes;

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(res, 500, { error: errText(error) });
  }
});

ensureStorage().then(() => {
  server.listen(PORT, () => {
    console.log(`[backend] started on http://127.0.0.1:${PORT}`);
    console.log(`[backend] data dir: ${DATA_DIR}`);
  });
});

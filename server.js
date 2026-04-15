const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3030);
const API_KEY = process.env.API_KEY || '7P5F36A-AQ44G61-JTW1QJN-E7R8YXZ';
const API_URL = 'https://api.kinopoisk.dev/v1.4/movie/search';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function normalizeMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Неизвестная ошибка сервера';
}

async function handleSearch(reqUrl, res) {
  const query = (reqUrl.searchParams.get('q') || '').trim();
  const page = (reqUrl.searchParams.get('page') || '1').trim();

  if (!query) {
    return sendJson(res, 400, { error: 'Параметр q обязателен' });
  }

  const upstream = new URL(API_URL);
  upstream.searchParams.set('query', query);
  upstream.searchParams.set('page', page);

  try {
    const response = await fetch(upstream.toString(), {
      headers: {
        'X-API-KEY': API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.message || data?.error || `Ошибка API: ${response.status}`;
      return sendJson(res, response.status, { error: message });
    }

    return sendJson(res, 200, data);
  } catch (error) {
    return sendJson(res, 500, { error: normalizeMessage(error) });
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${PORT}`}`);

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.method === 'GET' && reqUrl.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && reqUrl.pathname === '/search') {
    return handleSearch(reqUrl, res);
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[backend] started on http://127.0.0.1:${PORT}`);
});

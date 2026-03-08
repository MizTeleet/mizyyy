const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('results');
const player = document.getElementById('audio-player');
const nowPlaying = document.getElementById('now-playing');

let activeTrackId = null;

function msToTime(ms) {
  if (!ms) return '--:--';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function setStatus(message, kind = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function setNowPlaying(track) {
  if (!track) {
    nowPlaying.textContent = 'Ничего не воспроизводится';
    return;
  }

  nowPlaying.textContent = `Сейчас играет: ${track.artist} — ${track.title}`;
}

function playTrack(track) {
  activeTrackId = track.id;
  player.src = track.previewUrl;
  player.play().catch(() => setStatus('Не удалось запустить воспроизведение.', 'error'));
  setNowPlaying(track);

  const allItems = listEl.querySelectorAll('.track-item');
  allItems.forEach((item) => {
    item.classList.toggle('active', Number(item.dataset.id) === track.id);
  });
}

function renderTracks(tracks) {
  listEl.innerHTML = '';

  if (!tracks.length) {
    listEl.innerHTML = '<li class="empty">Ничего не найдено.</li>';
    return;
  }

  tracks.forEach((track) => {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.dataset.id = track.id;

    const meta = document.createElement('div');
    meta.className = 'track-meta';
    meta.innerHTML = `
      <img src="${track.coverUrl}" alt="Обложка ${track.title}" class="cover" />
      <div>
        <p class="title">${track.title}</p>
        <p class="artist">${track.artist}</p>
        <p class="album">${track.album || 'Без альбома'} · ${msToTime(track.durationMs)}</p>
      </div>
    `;

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.textContent = activeTrackId === track.id ? 'Играет' : '▶ Играть';
    playBtn.className = 'play-btn';
    playBtn.addEventListener('click', () => {
      playTrack(track);
      renderTracks(tracks);
    });

    li.append(meta, playBtn);
    listEl.appendChild(li);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();

  if (!query) {
    setStatus('Введите название трека или исполнителя.', 'error');
    return;
  }

  setStatus('Ищу музыку...', 'info');

  const { tracks, error } = await window.musicApi.searchTracks(query);

  if (error) {
    setStatus(error, 'error');
    renderTracks([]);
    return;
  }

  setStatus(`Найдено треков: ${tracks.length}`, 'success');
  renderTracks(tracks);
});

player.addEventListener('ended', () => setNowPlaying(null));

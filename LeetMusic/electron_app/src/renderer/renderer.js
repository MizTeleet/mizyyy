const api = window.leetMusicApi;
const audio = document.getElementById('audio');
const trackListEl = document.getElementById('trackList');
const statusEl = document.getElementById('status');
const nowTitle = document.getElementById('nowTitle');
const nowSub = document.getElementById('nowSub');
const miniTitle = document.getElementById('miniTitle');
const miniSub = document.getElementById('miniSub');
const playBtn = document.getElementById('playBtn');
const progress = document.getElementById('progress');
const timeEl = document.getElementById('time');
const volume = document.getElementById('volume');
const fogOverlay = document.getElementById('fogOverlay');

let tracks = [];
let currentIndex = -1;
let seeking = false;

function fmt(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderTracks() {
  trackListEl.innerHTML = '';
  statusEl.textContent = `Треков: ${tracks.length}`;
  if (!tracks.length) {
    const li = document.createElement('li');
    li.textContent = 'Нет треков в папке Music';
    trackListEl.append(li);
    return;
  }

  tracks.forEach((track, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${track.title}`;
    if (i === currentIndex) li.classList.add('active');
    li.addEventListener('click', () => playTrack(i));
    trackListEl.append(li);
  });
}

async function refreshTracks() {
  tracks = await api.listTracks();
  if (currentIndex >= tracks.length) currentIndex = -1;
  renderTracks();
}

function setFogPlaying(playing) {
  fogOverlay.classList.toggle('playing', playing);
}

function playTrack(index) {
  if (!tracks[index]) return;
  currentIndex = index;
  const track = tracks[index];
  audio.src = track.fileUrl;
  audio.play();
  playBtn.textContent = '❚❚';
  nowTitle.textContent = track.title;
  nowSub.textContent = track.name;
  miniTitle.textContent = track.title;
  miniSub.textContent = track.name;
  setFogPlaying(true);
  renderTracks();
}

playBtn.addEventListener('click', () => {
  if (currentIndex === -1 && tracks.length) return playTrack(0);
  if (audio.paused) {
    audio.play();
    playBtn.textContent = '❚❚';
    setFogPlaying(true);
  } else {
    audio.pause();
    playBtn.textContent = '▶';
    setFogPlaying(false);
  }
});

document.getElementById('playFromHero').addEventListener('click', () => playBtn.click());
document.getElementById('refreshBtn').addEventListener('click', refreshTracks);
document.getElementById('importBtn').addEventListener('click', async () => {
  const result = await api.importTracks();
  tracks = result.tracks;
  statusEl.textContent = `Треков: ${tracks.length} (+${result.copied})`;
  renderTracks();
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (!tracks.length) return;
  playTrack((currentIndex - 1 + tracks.length) % tracks.length);
});

document.getElementById('nextBtn').addEventListener('click', () => {
  if (!tracks.length) return;
  playTrack((currentIndex + 1) % tracks.length);
});

progress.addEventListener('input', () => {
  seeking = true;
  const sec = (Number(progress.value) / 100) * (audio.duration || 0);
  timeEl.textContent = `${fmt(sec)} / ${fmt(audio.duration)}`;
});
progress.addEventListener('change', () => {
  const sec = (Number(progress.value) / 100) * (audio.duration || 0);
  audio.currentTime = sec;
  seeking = false;
});

volume.addEventListener('input', () => { audio.volume = Number(volume.value) / 100; });

audio.addEventListener('timeupdate', () => {
  if (!seeking && audio.duration) progress.value = String((audio.currentTime / audio.duration) * 100);
  timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
});
audio.addEventListener('ended', () => {
  if (!tracks.length) return;
  playTrack((currentIndex + 1) % tracks.length);
});
audio.addEventListener('play', () => setFogPlaying(true));
audio.addEventListener('pause', () => setFogPlaying(false));

refreshTracks();

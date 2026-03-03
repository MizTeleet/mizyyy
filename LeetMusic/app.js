const audio = document.getElementById('audio');
const trackList = document.getElementById('trackList');
const likedList = document.getElementById('likedList');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const likeBtn = document.getElementById('likeBtn');
const coverInput = document.getElementById('coverInput');
const coverPreview = document.getElementById('coverPreview');
const detailCover = document.getElementById('detailCover');
const libraryStatus = document.getElementById('libraryStatus');
const splash = document.getElementById('splash');
const app = document.getElementById('app');

const playPauseBtn = document.getElementById('playPauseBtn');
const detailPlayPauseBtn = document.getElementById('detailPlayPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const detailPrevBtn = document.getElementById('detailPrevBtn');
const detailNextBtn = document.getElementById('detailNextBtn');
const muteBtn = document.getElementById('muteBtn');
const seekBar = document.getElementById('seekBar');
const volumeBar = document.getElementById('volumeBar');
const timeCurrent = document.getElementById('timeCurrent');
const timeTotal = document.getElementById('timeTotal');

const detailModal = document.getElementById('detailModal');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const showEqBtn = document.getElementById('showEqBtn');
const eqPanel = document.getElementById('eqPanel');
const coverPickerBtn = document.getElementById('coverPickerBtn');

const bassSlider = document.getElementById('bassSlider');
const midSlider = document.getElementById('midSlider');
const trebleSlider = document.getElementById('trebleSlider');

const likedSet = new Set(JSON.parse(localStorage.getItem('leetmusic_liked') || '[]'));
const customCovers = JSON.parse(localStorage.getItem('leetmusic_covers') || '{}');

let tracks = [];
let current = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const source = audioCtx.createMediaElementSource(audio);
const bass = audioCtx.createBiquadFilter();
const mid = audioCtx.createBiquadFilter();
const treble = audioCtx.createBiquadFilter();

bass.type = 'lowshelf';
bass.frequency.value = 200;
mid.type = 'peaking';
mid.frequency.value = 1000;
mid.Q.value = 1;
treble.type = 'highshelf';
treble.frequency.value = 3000;
source.connect(bass);
bass.connect(mid);
mid.connect(treble);
treble.connect(audioCtx.destination);

function showApp() {
  setTimeout(() => {
    splash.classList.remove('active');
    app.classList.remove('hidden');
  }, 1800);
}

function getTrackKey(track) {
  return `${track.name}_${track.size ?? track.url}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function updateTransportUI() {
  const duration = audio.duration || 0;
  const currentTime = audio.currentTime || 0;
  seekBar.value = duration ? (currentTime / duration) * 100 : 0;
  timeCurrent.textContent = formatTime(currentTime);
  timeTotal.textContent = formatTime(duration);
  const playIcon = audio.paused ? '▶' : '❚❚';
  playPauseBtn.textContent = playIcon;
  detailPlayPauseBtn.textContent = playIcon;
  muteBtn.textContent = audio.muted || audio.volume === 0 ? '🔇' : '🔊';
}

function updateCover(track) {
  const src = getCoverForTrack(track);
  coverPreview.src = src;
  detailCover.src = src;
}

function createTrackItem(track, isLikedTab = false) {
  const li = document.createElement('li');
  li.className = 'track-item';
  const main = document.createElement('div');
  main.className = 'track-main';
  main.innerHTML = `<strong>${track.name.replace(/\.[^.]+$/, '')}</strong><br/><small>${track.source || 'LeetMusic'}</small>`;
  main.onclick = () => playTrack(track, true);

  const heart = document.createElement('button');
  const key = getTrackKey(track);
  heart.textContent = likedSet.has(key) ? '♥' : '♡';
  heart.className = 'btn';
  heart.onclick = () => {
    toggleLike(track);
    renderLists();
  };

  li.append(main, heart);
  if (isLikedTab && !likedSet.has(key)) return null;
  return li;
}

function renderLists() {
  trackList.innerHTML = '';
  likedList.innerHTML = '';
  tracks.forEach((track) => {
    const recItem = createTrackItem(track);
    if (recItem) trackList.appendChild(recItem);
    const likedItem = createTrackItem(track, true);
    if (likedItem) likedList.appendChild(likedItem);
  });
}

function toggleLike(track) {
  const key = getTrackKey(track);
  if (likedSet.has(key)) likedSet.delete(key);
  else likedSet.add(key);
  localStorage.setItem('leetmusic_liked', JSON.stringify([...likedSet]));
  updateLikeButton();
}

function updateLikeButton() {
  if (!current) return;
  likeBtn.textContent = likedSet.has(getTrackKey(current)) ? '♥' : '♡';
}

function getCoverForTrack(track) {
  if (!track) return '';
  return customCovers[getTrackKey(track)] || '';
}

async function playTrack(track, openDetails = false) {
  current = track;
  trackTitle.textContent = track.name.replace(/\.[^.]+$/, '');
  trackArtist.textContent = 'LeetMusic';
  if (audio.src !== track.url) audio.src = track.url;
  await audioCtx.resume();
  await audio.play();
  updateCover(track);
  updateLikeButton();
  updateTransportUI();
  if (openDetails) openDetail();
}

async function autoLoadLeetMusicFolder() {
  try {
    const response = await fetch('./Music/');
    if (!response.ok) throw new Error('folder not found');
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href') || '');

    const audioLinks = links
      .filter((href) => /\.(mp3|wav|ogg|m4a|flac)$/i.test(href))
      .map((href) => ({
        name: decodeURIComponent(href),
        url: `./Music/${href}`,
        source: 'Папка Music'
      }));

    tracks = audioLinks;
    libraryStatus.textContent = tracks.length
      ? `Найдено треков в /Music: ${tracks.length}`
      : 'Папка /Music найдена, но треков нет';
    renderLists();
  } catch (error) {
    console.error(error);
    libraryStatus.textContent = 'Добавьте треки в папку /Music внутри каталога LeetMusic';
  }
}

coverPickerBtn.addEventListener('click', () => coverInput.click());
coverInput.addEventListener('change', () => {
  const file = coverInput.files?.[0];
  if (!file || !current) return;
  const reader = new FileReader();
  reader.onload = () => {
    const key = getTrackKey(current);
    customCovers[key] = reader.result;
    localStorage.setItem('leetmusic_covers', JSON.stringify(customCovers));
    updateCover(current);
  };
  reader.readAsDataURL(file);
});

likeBtn.addEventListener('click', () => {
  if (!current) return;
  toggleLike(current);
  renderLists();
});

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

function applyEqValues({ low, midGain, high }) {
  bass.gain.value = low;
  mid.gain.value = midGain;
  treble.gain.value = high;
  bassSlider.value = low;
  midSlider.value = midGain;
  trebleSlider.value = high;
}

document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    if (preset === 'flat') applyEqValues({ low: 0, midGain: 0, high: 0 });
    if (preset === 'bass') applyEqValues({ low: 12, midGain: -1, high: -2 });
    if (preset === 'vocal') applyEqValues({ low: 5, midGain: 4, high: 8 });
    if (preset === 'party') applyEqValues({ low: 10, midGain: 2, high: 10 });
  });
});

bassSlider.addEventListener('input', () => (bass.gain.value = Number(bassSlider.value)));
midSlider.addEventListener('input', () => (mid.gain.value = Number(midSlider.value)));
trebleSlider.addEventListener('input', () => (treble.gain.value = Number(trebleSlider.value)));

async function togglePlay() {
  if (!audio.src && tracks.length) {
    await playTrack(tracks[0]);
    return;
  }
  if (!audio.src) return;
  if (audio.paused) {
    await audioCtx.resume();
    await audio.play();
  } else {
    audio.pause();
  }
}

playPauseBtn.addEventListener('click', togglePlay);
detailPlayPauseBtn.addEventListener('click', togglePlay);

function skip(seconds) {
  if (!audio.src) return;
  audio.currentTime = Math.max(0, Math.min((audio.duration || 0), audio.currentTime + seconds));
}
[prevBtn, detailPrevBtn].forEach((btn) => btn.addEventListener('click', () => skip(-10)));
[nextBtn, detailNextBtn].forEach((btn) => btn.addEventListener('click', () => skip(10)));

seekBar.addEventListener('input', () => {
  if (!audio.duration) return;
  audio.currentTime = (Number(seekBar.value) / 100) * audio.duration;
});

volumeBar.addEventListener('input', () => {
  audio.volume = Number(volumeBar.value);
  audio.muted = audio.volume === 0;
  updateTransportUI();
});

muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateTransportUI();
});

function openDetail() {
  detailModal.classList.remove('hidden');
  detailModal.setAttribute('aria-hidden', 'false');
}
function closeDetail() {
  detailModal.classList.add('hidden');
  detailModal.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('.open-details').forEach((el) => {
  el.addEventListener('click', () => {
    if (!current && tracks.length) playTrack(tracks[0], true);
    else openDetail();
  });
});

closeDetailBtn.addEventListener('click', closeDetail);
showEqBtn.addEventListener('click', () => eqPanel.classList.toggle('hidden'));

audio.addEventListener('timeupdate', updateTransportUI);
audio.addEventListener('loadedmetadata', updateTransportUI);
audio.addEventListener('play', updateTransportUI);
audio.addEventListener('pause', updateTransportUI);
audio.addEventListener('ended', updateTransportUI);

showApp();
updateTransportUI();
autoLoadLeetMusicFolder();

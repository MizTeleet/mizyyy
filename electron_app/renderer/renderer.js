const api = window.leetMusicApi;
const audio = document.getElementById('audio');

const trackListEl = document.getElementById('trackList');
const favListEl = document.getElementById('favList');
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
const favToggleBtn = document.getElementById('favToggleBtn');
const ytResultsEl = document.getElementById('ytResults');
const heroPlayBtn = document.getElementById('heroPlayBtn');
const heroVibeTitle = document.getElementById('heroVibeTitle');

const favTitleInput = document.getElementById('favTitleInput');
const favDescInput = document.getElementById('favDescInput');
const favCoverPreview = document.getElementById('favCoverPreview');

let tracks = [];
let currentIndex = -1;
let selectedFavId = null;
let seeking = false;
let musicDirHint = '';
let ytFavorites = [];

let audioCtx;
let sourceNode;
let bassFilter;
let midFilter;
let trebleFilter;
let vocalFilter;
let analyserNode;
let heroAnimationFrame = null;


function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function setPlayButtonState(isPlaying) {
  const icon = isPlaying ? 'pause' : 'play';
  playBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
  playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  heroPlayBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
  heroPlayBtn.setAttribute('aria-label', isPlaying ? 'Hero pause' : 'Hero play');
  refreshIcons();
}

function setFavoriteButtonState(isFav) {
  favToggleBtn.classList.toggle('is-favorite', Boolean(isFav));
  favToggleBtn.style.opacity = isFav ? '1' : '0.75';
}

function fmt(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function activeTrack() {
  return tracks[currentIndex] || null;
}

function setFogPlaying(playing) {
  fogOverlay.classList.toggle('playing', playing);
}


function stopHeroBeatAnimation() {
  if (heroAnimationFrame) cancelAnimationFrame(heroAnimationFrame);
  heroAnimationFrame = null;
  heroVibeTitle.classList.remove('playing');
  heroVibeTitle.style.setProperty('--beat-intensity', '0');
}

function startHeroBeatAnimation() {
  heroVibeTitle.classList.add('playing');
  if (!analyserNode || heroAnimationFrame) return;

  const spectrum = new Uint8Array(analyserNode.frequencyBinCount);
  let smoothed = 0;

  const tick = () => {
    analyserNode.getByteFrequencyData(spectrum);
    const energy = spectrum.reduce((sum, v) => sum + v, 0) / (spectrum.length * 255);
    smoothed = smoothed * 0.84 + energy * 0.16;
    const intensity = Math.min(1, smoothed * 1.85);
    heroVibeTitle.style.setProperty('--beat-intensity', intensity.toFixed(3));

    if (!audio.paused) {
      heroAnimationFrame = requestAnimationFrame(tick);
    } else {
      stopHeroBeatAnimation();
    }
  };

  heroAnimationFrame = requestAnimationFrame(tick);
}

function setPlaybackVisualState(isPlaying) {
  setPlayButtonState(isPlaying);
  setFogPlaying(isPlaying);
  if (isPlaying) startHeroBeatAnimation();
  else stopHeroBeatAnimation();
}

async function togglePlayback() {
  if (currentIndex === -1 && tracks.length) {
    await playTrack(0);
    return;
  }

  if (!audio.src) return;

  if (audio.paused) {
    if (audioCtx?.state === 'suspended') await audioCtx.resume();
    await audio.play();
    setPlaybackVisualState(true);
  } else {
    audio.pause();
    setPlaybackVisualState(false);
  }
}

function renderTracks() {
  trackListEl.innerHTML = '';
  statusEl.textContent = musicDirHint ? `Треков: ${tracks.length} • ${musicDirHint}` : `Треков: ${tracks.length}`;

  if (!tracks.length) {
    const li = document.createElement('li');
    li.textContent = 'Нет треков в папке Music/LeetMusic';
    trackListEl.append(li);
  } else {
    tracks.forEach((track, i) => {
      const li = document.createElement('li');
      const displayTitle = track.customTitle || track.title;
      li.innerHTML = `<strong>${track.favorite ? '❤ ' : ''}${displayTitle}</strong><br/><small>${track.description || track.name}</small>`;
      if (i === currentIndex) li.classList.add('active');
      li.addEventListener('click', () => playTrack(i));
      trackListEl.append(li);
    });
  }

  renderFavorites();
}

function renderFavorites() {
  favListEl.innerHTML = '';
  const localFavTracks = tracks.filter((t) => t.favorite);
  const allFav = [
    ...localFavTracks.map((t) => ({ id: t.id, title: t.customTitle || t.title, isYoutube: false })),
    ...ytFavorites.map((t) => ({ id: `yt:${t.id}`, title: `YT: ${t.title}`, isYoutube: true })),
  ];

  if (!allFav.length) {
    const li = document.createElement('li');
    li.textContent = 'Избранных треков пока нет';
    favListEl.append(li);
    return;
  }

  allFav.forEach((track) => {
    const li = document.createElement('li');
    li.textContent = track.title;
    if (track.id === selectedFavId) li.classList.add('active');
    li.addEventListener('click', () => selectFavorite(track.id));
    favListEl.append(li);
  });
}

function selectFavorite(trackId) {
  selectedFavId = trackId;
  if (trackId.startsWith('yt:')) {
    const item = ytFavorites.find((x) => `yt:${x.id}` === trackId);
    favTitleInput.value = item?.title || '';
    favDescInput.value = item?.description || '';
    favCoverPreview.src = item?.thumbnail || '';
    renderFavorites();
    return;
  }

  const track = tracks.find((t) => t.id === trackId);
  if (!track) return;
  favTitleInput.value = track.customTitle || track.title;
  favDescInput.value = track.description || '';
  favCoverPreview.src = track.coverPath || '';
  renderFavorites();
}

async function refreshTracks() {
  tracks = await api.listTracks();
  if (currentIndex >= tracks.length) currentIndex = -1;
  if (selectedFavId && !tracks.some((t) => t.id === selectedFavId) && !selectedFavId.startsWith('yt:')) selectedFavId = null;
  renderTracks();
}

async function ensureAudioGraph() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  sourceNode = audioCtx.createMediaElementSource(audio);

  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 200;

  midFilter = audioCtx.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;

  trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 4200;

  vocalFilter = audioCtx.createBiquadFilter();
  vocalFilter.type = 'peaking';
  vocalFilter.frequency.value = 2800;
  vocalFilter.Q.value = 1.5;

  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 128;

  sourceNode.connect(bassFilter);
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
  trebleFilter.connect(vocalFilter);
  vocalFilter.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

async function playTrack(index) {
  if (!tracks[index]) return;
  currentIndex = index;
  const track = tracks[index];
  audio.src = track.fileUrl;
  await ensureAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  await audio.play();

  const displayTitle = track.customTitle || track.title;
  nowTitle.textContent = displayTitle;
  nowSub.textContent = track.description || track.name;
  miniTitle.textContent = displayTitle;
  miniSub.textContent = track.name;
  setFavoriteButtonState(track.favorite);
  setPlaybackVisualState(true);
  renderTracks();
}

async function playYoutubeResult(item) {
  await ensureAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  const streamUrl = await api.ytStreamUrl(item.url);
  audio.src = streamUrl;
  await audio.play();
  nowTitle.textContent = item.title;
  nowSub.textContent = `${item.author || 'YouTube'} ${item.duration ? `• ${item.duration}` : ''}`;
  miniTitle.textContent = item.title;
  miniSub.textContent = 'YouTube stream';
  setPlaybackVisualState(true);
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
}

playBtn.addEventListener('click', togglePlayback);
heroPlayBtn.addEventListener('click', togglePlayback);

favToggleBtn.addEventListener('click', async () => {
  const track = activeTrack();
  if (!track) return;
  track.favorite = !track.favorite;
  await api.saveTrackMeta(track.id, { favorite: track.favorite });
  setFavoriteButtonState(track.favorite);
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

document.querySelectorAll('.nav-btn[data-tab]').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

document.getElementById('importBtn').addEventListener('click', async () => {
  const result = await api.importTracks();
  tracks = result.tracks;
  statusEl.textContent = `Треков: ${tracks.length} (+${result.copied})`;
  renderTracks();
});

document.getElementById('ytSearchBtn').addEventListener('click', async () => {
  const query = document.getElementById('ytSearchInput').value.trim();
  ytResultsEl.innerHTML = '';
  if (!query) return;
  const results = (await api.ytSearch(query)).slice(0, 5);
  if (!results.length) {
    ytResultsEl.innerHTML = '<li class="yt-item">Ничего не найдено</li>';
    return;
  }

  results.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'yt-item';
    const info = document.createElement('div');
    info.innerHTML = `<strong>${item.title}</strong><br/><small>${item.author || ''} ${item.duration ? '• ' + item.duration : ''}</small>`;

    const actions = document.createElement('div');
    actions.className = 'yt-actions';

    const play = document.createElement('button');
    play.textContent = 'Play';
    play.addEventListener('click', () => playYoutubeResult(item));

    const dl = document.createElement('button');
    dl.textContent = 'Download';
    dl.addEventListener('click', async () => {
      await api.ytDownload(item.url);
      await refreshTracks();
    });

    const fav = document.createElement('button');
    fav.textContent = 'Add to favorites';
    fav.addEventListener('click', () => {
      if (!ytFavorites.some((x) => x.id === item.id)) ytFavorites.push({ ...item, description: '' });
      renderFavorites();
      switchTab('favorites');
    });

    actions.append(play, dl, fav);
    li.append(info, actions);
    ytResultsEl.append(li);
  });
});

document.getElementById('ytSearchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('ytSearchBtn').click();
});

progress.addEventListener('input', () => {
  seeking = true;
  const sec = (Number(progress.value) / 100) * (audio.duration || 0);
  timeEl.textContent = `${fmt(sec)} / ${fmt(audio.duration)}`;
});

progress.addEventListener('change', () => {
  audio.currentTime = (Number(progress.value) / 100) * (audio.duration || 0);
  seeking = false;
});

volume.addEventListener('input', () => {
  audio.volume = Number(volume.value) / 100;
});
audio.volume = 0.85;

audio.addEventListener('timeupdate', () => {
  if (!seeking && audio.duration) progress.value = String((audio.currentTime / audio.duration) * 100);
  timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
});

audio.addEventListener('ended', () => {
  if (!tracks.length) return;
  playTrack((currentIndex + 1) % tracks.length);
});

audio.addEventListener('pause', () => setPlaybackVisualState(false));
audio.addEventListener('play', () => setPlaybackVisualState(true));

const eqModal = document.getElementById('eqModal');
function openEq() {
  eqModal.hidden = false;
}
function closeEq() {
  eqModal.hidden = true;
}

document.getElementById('openEqBtn').addEventListener('click', openEq);
document.getElementById('bottomMetaClick').addEventListener('click', openEq);
document.getElementById('eqCloseBtn').addEventListener('click', closeEq);
document.getElementById('eqCloseBackdrop').addEventListener('click', closeEq);

function setEqValues({ bass = 0, mid = 0, treble = 0, vocal = 0 }) {
  document.getElementById('eqBass').value = bass;
  document.getElementById('eqMid').value = mid;
  document.getElementById('eqTreble').value = treble;
  document.getElementById('eqVocal').value = vocal;
  if (bassFilter) bassFilter.gain.value = bass;
  if (midFilter) midFilter.gain.value = mid;
  if (trebleFilter) trebleFilter.gain.value = treble;
  if (vocalFilter) vocalFilter.gain.value = vocal;
}

['eqBass', 'eqMid', 'eqTreble', 'eqVocal'].forEach((id) => {
  document.getElementById(id).addEventListener('input', async () => {
    await ensureAudioGraph();
    setEqValues({
      bass: Number(document.getElementById('eqBass').value),
      mid: Number(document.getElementById('eqMid').value),
      treble: Number(document.getElementById('eqTreble').value),
      vocal: Number(document.getElementById('eqVocal').value),
    });
  });
});

const presets = {
  flat: { bass: 0, mid: 0, treble: 0, vocal: 0 },
  bass: { bass: 8, mid: -1, treble: 2, vocal: 0 },
  vocal: { bass: -2, mid: 3, treble: 2, vocal: 7 },
  treble: { bass: -1, mid: 0, treble: 7, vocal: 2 },
};

document.querySelectorAll('.eq-presets button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await ensureAudioGraph();
    setEqValues(presets[btn.dataset.preset] || presets.flat);
  });
});

document.getElementById('pickCoverBtn').addEventListener('click', async () => {
  if (!selectedFavId || selectedFavId.startsWith('yt:')) return;
  const coverPath = await api.pickCover();
  if (!coverPath) return;
  await api.saveTrackMeta(selectedFavId, { coverPath });
  await refreshTracks();
  selectFavorite(selectedFavId);
});

document.getElementById('saveFavBtn').addEventListener('click', async () => {
  if (!selectedFavId) return;
  if (selectedFavId.startsWith('yt:')) {
    const item = ytFavorites.find((x) => `yt:${x.id}` === selectedFavId);
    if (!item) return;
    item.title = favTitleInput.value.trim() || item.title;
    item.description = favDescInput.value.trim();
    renderFavorites();
    selectFavorite(selectedFavId);
    return;
  }

  await api.saveTrackMeta(selectedFavId, {
    customTitle: favTitleInput.value.trim(),
    description: favDescInput.value.trim(),
    favorite: true,
  });
  await refreshTracks();
  selectFavorite(selectedFavId);
});

document.getElementById('exportFavBtn').addEventListener('click', async () => {
  if (!selectedFavId) return;
  if (selectedFavId.startsWith('yt:')) {
    const item = ytFavorites.find((x) => `yt:${x.id}` === selectedFavId);
    if (!item) return;
    await api.exportTrackCard({
      id: item.id,
      title: item.title,
      filename: item.title,
      description: item.description || '',
      coverPath: item.thumbnail || '',
      youtubeUrl: item.url,
    });
    return;
  }

  const track = tracks.find((t) => t.id === selectedFavId);
  if (!track) return;
  await api.exportTrackCard({
    id: track.id,
    title: track.customTitle || track.title,
    filename: track.name,
    description: track.description || '',
    coverPath: track.coverPath || '',
  });
});

api.getMusicDir().then((dir) => {
  musicDirHint = dir;
  renderTracks();
}).catch(() => {});

refreshTracks();
switchTab('home');
setEqValues(presets.flat);
setPlaybackVisualState(false);
setFavoriteButtonState(false);
refreshIcons();

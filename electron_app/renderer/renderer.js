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
const forYouGroupsEl = document.getElementById('forYouGroups');

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
let masterGainNode;
let heroAnimationFrame = null;

const BEHAVIOR_STORAGE_KEY = 'leetmusic_behavior_v1';
const RECOMMEND_CACHE_KEY = 'leetmusic_reco_cache_v1';
const MAX_RECENT = 30;
const MAX_GROUPS = 3;
const MAX_TRACKS_PER_GROUP = 5;
const CACHE_TTL_MS = 1000 * 60 * 30;
const STOPWORDS = new Set(['official', 'video', 'audio', 'music', 'feat', 'ft', 'prod', 'remix', 'edit', 'live', 'version', 'clip', 'lyrics', 'and', 'the']);

let behaviorStore = loadBehaviorStore();
let recommendationCache = loadRecommendationCache();
let forYouDirty = true;
let forYouLoading = false;


function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadBehaviorStore() {
  const parsed = safeJsonParse(localStorage.getItem(BEHAVIOR_STORAGE_KEY) || '{}', {});
  return {
    tracks: parsed.tracks || {},
    recent: Array.isArray(parsed.recent) ? parsed.recent.slice(0, MAX_RECENT) : [],
  };
}

function persistBehaviorStore() {
  localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(behaviorStore));
}

function loadRecommendationCache() {
  const parsed = safeJsonParse(localStorage.getItem(RECOMMEND_CACHE_KEY) || '{}', {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function persistRecommendationCache() {
  localStorage.setItem(RECOMMEND_CACHE_KEY, JSON.stringify(recommendationCache));
}

function normalizeSpaces(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseArtistFromTitle(title, fallback = '') {
  const cleaned = normalizeSpaces(title);
  if (!cleaned) return fallback;
  const parts = cleaned.split(/\s[-–—]\s/);
  if (parts.length > 1) return parts[0].trim();
  return fallback || '';
}

function extractKeywords(text) {
  return normalizeSpaces(text)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
    .slice(0, 6);
}

function updateBehaviorEntry({ title, artist = '', liked = false, played = false }) {
  const normalizedTitle = normalizeSpaces(title);
  if (!normalizedTitle) return;
  const key = normalizedTitle.toLowerCase();
  const now = Date.now();
  const existing = behaviorStore.tracks[key] || {
    title: normalizedTitle,
    artist: normalizeSpaces(artist),
    playCount: 0,
    liked: false,
    lastPlayed: 0,
  };

  existing.title = normalizedTitle;
  if (!existing.artist) existing.artist = normalizeSpaces(artist);
  if (played) {
    existing.playCount += 1;
    existing.lastPlayed = now;
    behaviorStore.recent = [key, ...behaviorStore.recent.filter((id) => id !== key)].slice(0, MAX_RECENT);
  }
  if (liked) existing.liked = true;
  behaviorStore.tracks[key] = existing;
  persistBehaviorStore();
  forYouDirty = true;
}

function setTrackLikedSignal(track, liked) {
  if (!track) return;
  updateBehaviorEntry({
    title: track.customTitle || track.title || track.name,
    artist: parseArtistFromTitle(track.customTitle || track.title || track.name),
    liked,
    played: false,
  });
  const key = normalizeSpaces(track.customTitle || track.title || track.name).toLowerCase();
  if (behaviorStore.tracks[key]) {
    behaviorStore.tracks[key].liked = Boolean(liked);
    persistBehaviorStore();
    forYouDirty = true;
  }
}

function computeSignalScore(entry) {
  const recencyDays = (Date.now() - (entry.lastPlayed || 0)) / (1000 * 60 * 60 * 24);
  const recentBoost = recencyDays <= 7 ? 3 : recencyDays <= 30 ? 1.5 : 0;
  return (entry.liked ? 10 : 0) + Math.min(5, entry.playCount) + recentBoost;
}

function buildRecommendationQueries() {
  const entries = Object.values(behaviorStore.tracks);
  if (!entries.length) return [];

  const artistScores = new Map();
  const keywordScores = new Map();

  entries.forEach((entry) => {
    const score = computeSignalScore(entry);
    const artist = normalizeSpaces(entry.artist || parseArtistFromTitle(entry.title));
    if (artist) artistScores.set(artist, (artistScores.get(artist) || 0) + score);
    extractKeywords(entry.title).forEach((keyword) => {
      keywordScores.set(keyword, (keywordScores.get(keyword) || 0) + score * 0.7);
    });
  });

  const topArtists = [...artistScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([artist]) => artist);
  const topKeywords = [...keywordScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([kw]) => kw);

  const queries = [];
  topArtists.forEach((artist) => {
    queries.push({ label: `${artist} mix`, query: `${artist} mix` });
    queries.push({ label: `${artist} playlist`, query: `${artist} similar artists playlist` });
  });
  topKeywords.forEach((keyword) => {
    const label = `${keyword[0].toUpperCase()}${keyword.slice(1)} подборка`;
    queries.push({ label, query: `${keyword} playlist` });
    queries.push({ label: `${keyword} vibes`, query: `${keyword} mix 2024` });
  });

  return queries.slice(0, MAX_GROUPS * 2);
}

async function searchWithCache(query) {
  const cacheItem = recommendationCache[query];
  if (cacheItem && Date.now() - cacheItem.savedAt < CACHE_TTL_MS && Array.isArray(cacheItem.items)) {
    return cacheItem.items;
  }

  const items = (await api.ytSearch(query)).slice(0, MAX_TRACKS_PER_GROUP);
  recommendationCache[query] = { savedAt: Date.now(), items };
  persistRecommendationCache();
  return items;
}

function createForYouTrackItem(item) {
  const li = document.createElement('li');
  li.className = 'yt-item';
  const info = document.createElement('div');
  info.innerHTML = `<strong>${item.title}</strong><br/><small>${item.duration || '—'}</small>`;

  const actions = document.createElement('div');
  actions.className = 'yt-actions';

  const play = document.createElement('button');
  play.textContent = 'Play';
  play.addEventListener('click', () => playYoutubeResult(item));

  const fav = document.createElement('button');
  fav.textContent = 'Add to favorites';
  fav.addEventListener('click', () => {
    if (!ytFavorites.some((x) => x.id === item.id)) ytFavorites.push({ ...item, description: '' });
    updateBehaviorEntry({
      title: item.title,
      artist: item.author || parseArtistFromTitle(item.title),
      liked: true,
      played: false,
    });
    renderFavorites();
  });

  actions.append(play, fav);
  li.append(info, actions);
  return li;
}

async function renderForYou() {
  if (!forYouGroupsEl) return;
  if (forYouLoading) return;
  if (!forYouDirty && forYouGroupsEl.childElementCount > 0) return;
  forYouLoading = true;

  forYouGroupsEl.innerHTML = '<div class="yt-item">Подбираем рекомендации…</div>';
  const queries = buildRecommendationQueries();
  if (!queries.length) {
    forYouGroupsEl.innerHTML = '<div class="yt-item">Слушай треки и добавляй в избранное — тут появятся персональные рекомендации.</div>';
    forYouLoading = false;
    forYouDirty = false;
    return;
  }

  const seenIds = new Set();
  const groups = [];
  for (const candidate of queries) {
    const items = await searchWithCache(candidate.query);
    const deduped = items.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    }).slice(0, MAX_TRACKS_PER_GROUP);
    if (!deduped.length) continue;
    groups.push({ label: candidate.label, items: deduped });
    if (groups.length >= MAX_GROUPS) break;
  }

  forYouGroupsEl.innerHTML = '';
  if (!groups.length) {
    forYouGroupsEl.innerHTML = '<div class="yt-item">Недостаточно данных для рекомендаций. Попробуй послушать ещё несколько треков.</div>';
    forYouLoading = false;
    forYouDirty = false;
    return;
  }

  groups.forEach((group) => {
    const block = document.createElement('section');
    block.className = 'for-you-group';
    block.innerHTML = `<h4>${group.label}</h4>`;
    const list = document.createElement('ul');
    group.items.forEach((item) => list.append(createForYouTrackItem(item)));
    block.append(list);
    forYouGroupsEl.append(block);
  });

  forYouLoading = false;
  forYouDirty = false;
}

function setPlayButtonState(isPlaying) {
  const dockIcon = isPlaying ? 'pause' : 'play';
  playBtn.innerHTML = `<i data-lucide="${dockIcon}"></i>`;
  playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');

  heroPlayBtn.innerHTML = '<i data-lucide="play"></i>';
  heroPlayBtn.classList.toggle('playing', isPlaying);
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
    ...ytFavorites.map((t) => ({ id: `yt:${t.id}`, title: `Online: ${t.title}`, isYoutube: true })),
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
  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.value = Number(volume.value) / 100;

  sourceNode.connect(bassFilter);
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
  trebleFilter.connect(vocalFilter);
  vocalFilter.connect(analyserNode);
  analyserNode.connect(masterGainNode);
  masterGainNode.connect(audioCtx.destination);
}

function fadeInCurrentTrack(durationSeconds = 0.8) {
  if (!audioCtx || !masterGainNode) return;
  const now = audioCtx.currentTime;
  const targetGain = Number(volume.value) / 100;
  masterGainNode.gain.cancelScheduledValues(now);
  masterGainNode.gain.setValueAtTime(0, now);
  masterGainNode.gain.linearRampToValueAtTime(targetGain, now + durationSeconds);
}

async function playTrack(index) {
  if (!tracks[index]) return;
  currentIndex = index;
  const track = tracks[index];
  audio.src = track.fileUrl;
  await ensureAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  await audio.play();
  fadeInCurrentTrack();

  const displayTitle = track.customTitle || track.title;
  nowTitle.textContent = displayTitle;
  nowSub.textContent = track.description || track.name;
  miniTitle.textContent = displayTitle;
  miniSub.textContent = track.name;
  setFavoriteButtonState(track.favorite);
  setPlaybackVisualState(true);
  updateBehaviorEntry({
    title: displayTitle,
    artist: parseArtistFromTitle(displayTitle),
    liked: Boolean(track.favorite),
    played: true,
  });
  renderTracks();
}

async function playYoutubeResult(item) {
  await ensureAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  const streamUrl = await api.ytStreamUrl(item.url);
  audio.src = streamUrl;
  await audio.play();
  fadeInCurrentTrack();
  nowTitle.textContent = item.title;
  nowSub.textContent = `${item.author || 'Online'} ${item.duration ? `• ${item.duration}` : ''}`;
  miniTitle.textContent = item.title;
  miniSub.textContent = 'Online stream';
  setPlaybackVisualState(true);
  updateBehaviorEntry({
    title: item.title,
    artist: item.author || parseArtistFromTitle(item.title),
    played: true,
  });
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'for-you') renderForYou();
}

playBtn.addEventListener('click', togglePlayback);
heroPlayBtn.addEventListener('click', togglePlayback);
heroVibeTitle.addEventListener('click', togglePlayback);
heroVibeTitle.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  togglePlayback();
});

favToggleBtn.addEventListener('click', async () => {
  const track = activeTrack();
  if (!track) return;
  track.favorite = !track.favorite;
  await api.saveTrackMeta(track.id, { favorite: track.favorite });
  setTrackLikedSignal(track, track.favorite);
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
      updateBehaviorEntry({
        title: item.title,
        artist: item.author || parseArtistFromTitle(item.title),
        liked: true,
        played: false,
      });
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
  if (masterGainNode && audioCtx) {
    const now = audioCtx.currentTime;
    const targetGain = Number(volume.value) / 100;
    masterGainNode.gain.cancelScheduledValues(now);
    masterGainNode.gain.setValueAtTime(masterGainNode.gain.value, now);
    masterGainNode.gain.linearRampToValueAtTime(targetGain, now + 0.08);
  }
});
audio.volume = 1;

audio.addEventListener('timeupdate', () => {
  if (!seeking && audio.duration) progress.value = String((audio.currentTime / audio.duration) * 100);
  timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
});

audio.addEventListener('ended', () => {
  setPlaybackVisualState(false);
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
  const updatedTrack = tracks.find((t) => t.id === selectedFavId);
  if (updatedTrack) setTrackLikedSignal(updatedTrack, true);
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

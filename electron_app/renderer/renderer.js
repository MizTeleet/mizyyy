const api = window.leetMusicApi;
const firebaseClient = window.firebaseClient;
const audio = document.getElementById('audio');

const trackListEl = document.getElementById('trackList');
const favListEl = document.getElementById('favList');
const statusEl = document.getElementById('status');
const nowTitle = document.getElementById('nowTitle');
const nowSub = document.getElementById('nowSub');
const miniTitle = document.getElementById('miniTitle');
const miniSub = document.getElementById('miniSub');
const playBtn = document.getElementById('playBtn');
const autoPlayNextBtn = document.getElementById('autoPlayNextBtn');
const progress = document.getElementById('progress');
const timeEl = document.getElementById('time');
const playStatusEl = document.getElementById('playStatus');
const volume = document.getElementById('volume');
const fogOverlay = document.getElementById('fogOverlay');
const favToggleBtn = document.getElementById('favToggleBtn');
const ytResultsEl = document.getElementById('ytResults');
const heroPlayBtn = document.getElementById('heroPlayBtn');
const heroVibeTitle = document.getElementById('heroVibeTitle');
const forYouListEl = document.getElementById('forYouList');
const profileBtn = document.getElementById('profileBtn');
const sidebarAvatarImg = document.getElementById('sidebarAvatarImg');
const sidebarAvatarFallback = document.getElementById('sidebarAvatarFallback');
const heroProfileAvatar = document.getElementById('heroProfileAvatar');
const authModal = document.getElementById('authModal');
const authBackdrop = document.getElementById('authBackdrop');
const authCloseBtn = document.getElementById('authCloseBtn');
const authGuestView = document.getElementById('authGuestView');
const authUserView = document.getElementById('authUserView');
const profileNicknameInput = document.getElementById('profileNickname');
const profileEmailInput = document.getElementById('profileEmail');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const authNameInput = document.getElementById('authName');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const authStatusEl = document.getElementById('authStatus');
const userAvatarEl = document.getElementById('userAvatar');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
const avatarInput = document.getElementById('avatarInput');

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
const MAX_RECOMMENDED_TRACKS = 5;
const MAX_QUERY_COUNT = 5;
const CACHE_TTL_MS = 1000 * 60 * 30;
const STOPWORDS = new Set(['official', 'video', 'audio', 'music', 'feat', 'ft', 'prod', 'remix', 'edit', 'live', 'version', 'clip', 'lyrics', 'and', 'the']);
const BLOCKED_TITLE_TERMS = ['playlist', '1 hour', 'mix', 'full album', 'live', 'remix', 'slowed', 'nightcore', 'bass boosted'];
const USER_NICKNAME_KEY = 'userNickname';
const USER_AVATAR_KEY = 'userAvatar';

let behaviorStore = loadBehaviorStore();
let recommendationCache = loadRecommendationCache();
let forYouDirty = true;
let forYouLoading = false;
let currentUser = null;
let currentUserDoc = null;
let autoPlayNextEnabled = false;
let currentOnlineQueue = [];
let currentOnlineIndex = -1;
let currentSourceType = 'none';
let currentPlayingId = '';
let currentYtResults = [];

const preparedAudioCache = new Map();
const preparedAudioOrder = [];
const MAX_PREPARED_AUDIO = 5;
const STREAM_REQUEST_DEBOUNCE_MS = 400;
const MAX_STREAM_CONCURRENCY = 2;
const hoverPreloadTimers = new Map();
const streamRequestQueue = [];
let activeStreamRequests = 0;


function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function setPlayStatus(message = '') {
  playStatusEl.textContent = message;
}

function rememberPreparedKey(key, prepared) {
  if (!preparedAudioCache.has(key)) {
    preparedAudioOrder.push(key);
    while (preparedAudioOrder.length > MAX_PREPARED_AUDIO) {
      const staleKey = preparedAudioOrder.shift();
      preparedAudioCache.delete(staleKey);
    }
  }
  preparedAudioCache.set(key, prepared);
}

function getPreparedAudio(key) {
  return preparedAudioCache.get(key) || null;
}

function cleanupPreparedCache() {
  while (preparedAudioOrder.length > MAX_PREPARED_AUDIO) {
    const staleKey = preparedAudioOrder.shift();
    preparedAudioCache.delete(staleKey);
  }
}

function createPreparedAudio(key, src) {
  if (!src) return null;
  const existing = getPreparedAudio(key);
  if (existing?.ready) return existing;

  const prepared = existing || { audio: new Audio(src), src, ready: false };
  prepared.audio.preload = 'auto';
  prepared.audio.src = src;
  prepared.audio.load();
  prepared.audio.addEventListener('canplaythrough', () => {
    prepared.ready = true;
    if (key === `active:${audio.src}`) setPlayStatus('');
  }, { once: true });
  rememberPreparedKey(key, prepared);
  return prepared;
}

function isRateLimitError(error) {
  return String(error?.message || error || '').includes('429');
}

function enqueueStreamRequest(task, priority = 'normal') {
  return new Promise((resolve, reject) => {
    const job = { task, resolve, reject };
    if (priority === 'high') streamRequestQueue.unshift(job);
    else streamRequestQueue.push(job);
    drainStreamQueue();
  });
}

function drainStreamQueue() {
  while (activeStreamRequests < MAX_STREAM_CONCURRENCY && streamRequestQueue.length) {
    const next = streamRequestQueue.shift();
    activeStreamRequests += 1;
    Promise.resolve()
      .then(next.task)
      .then(next.resolve)
      .catch(next.reject)
      .finally(() => {
        activeStreamRequests -= 1;
        drainStreamQueue();
      });
  }
}

async function getStreamUrlWithRetry(videoUrl, priority = 'normal') {
  try {
    return await enqueueStreamRequest(() => api.ytStreamUrl(videoUrl), priority);
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 4000));
    return enqueueStreamRequest(() => api.ytStreamUrl(videoUrl), priority);
  }
}

async function prepareYoutubeTrack(item, priority = 'normal') {
  const key = `yt:${item.id}`;
  const existing = getPreparedAudio(key);
  if (existing) return existing;
  const streamUrl = await getStreamUrlWithRetry(item.url, priority);
  return createPreparedAudio(key, streamUrl);
}

function scheduleHoverPreload(item) {
  const key = `yt:${item.id}`;
  if (getPreparedAudio(key)) return;
  if (hoverPreloadTimers.has(key)) return;
  const timer = setTimeout(async () => {
    hoverPreloadTimers.delete(key);
    try {
      await prepareYoutubeTrack(item, 'normal');
    } catch {}
  }, STREAM_REQUEST_DEBOUNCE_MS);
  hoverPreloadTimers.set(key, timer);
}

function cancelHoverPreload(item) {
  const key = `yt:${item.id}`;
  const timer = hoverPreloadTimers.get(key);
  if (!timer) return;
  clearTimeout(timer);
  hoverPreloadTimers.delete(key);
}

function setAuthStatus(message) {
  authStatusEl.textContent = message;
}

function getStoredNickname() {
  return localStorage.getItem(USER_NICKNAME_KEY) || '';
}

function getStoredAvatar() {
  return localStorage.getItem(USER_AVATAR_KEY) || '';
}

function setStoredNickname(nickname) {
  const clean = (nickname || '').trim();
  if (clean) localStorage.setItem(USER_NICKNAME_KEY, clean);
  else localStorage.removeItem(USER_NICKNAME_KEY);
}

function setStoredAvatar(avatarBase64) {
  if (avatarBase64) localStorage.setItem(USER_AVATAR_KEY, avatarBase64);
  else localStorage.removeItem(USER_AVATAR_KEY);
}

function applyProfileVisuals() {
  const nickname = getStoredNickname() || currentUserDoc?.nickname || 'Твой вайб';
  const avatar = getStoredAvatar();
  nowTitle.textContent = nickname;
  nowSub.textContent = 'Слушай музыку в LeetMusic';
  authNameInput.value = nickname;
  profileNicknameInput.value = nickname;

  if (avatar) {
    sidebarAvatarImg.src = avatar;
    sidebarAvatarImg.style.display = 'block';
    sidebarAvatarFallback.style.display = 'none';
    heroProfileAvatar.src = avatar;
    userAvatarEl.src = avatar;
  } else {
    sidebarAvatarImg.style.display = 'none';
    sidebarAvatarFallback.style.display = 'inline-block';
    heroProfileAvatar.removeAttribute('src');
    userAvatarEl.removeAttribute('src');
  }
}

function updateAuthUi(profile) {
  const isLoggedIn = Boolean(currentUser);
  authGuestView.hidden = isLoggedIn;
  authUserView.hidden = !isLoggedIn;

  if (!isLoggedIn) {
    authNameInput.value = getStoredNickname() || '';
    authEmailInput.value = '';
    authPasswordInput.value = '';
    profileNicknameInput.value = getStoredNickname() || '';
    profileEmailInput.value = '';
    applyProfileVisuals();
    setAuthStatus('Guest mode');
    return;
  }

  const nickname = getStoredNickname() || profile?.nickname || currentUser?.displayName || '';
  const email = profile?.email || currentUser?.email || '';
  const avatarUrl = getStoredAvatar() || profile?.avatarUrl || '';
  setStoredNickname(nickname);
  if (avatarUrl) setStoredAvatar(avatarUrl);
  profileNicknameInput.value = nickname;
  profileEmailInput.value = email;
  userAvatarEl.src = avatarUrl;
  applyProfileVisuals();
  setAuthStatus(`Signed in as ${nickname || email || 'user'}`);
}

function openAuthModal() {
  authModal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeAuthModal() {
  authModal.hidden = true;
  document.body.classList.remove('modal-open');
}

function collectCloudFavorites() {
  const localFavoriteTracks = tracks
    .filter((track) => track.favorite)
    .map((track) => ({
      id: `local:${track.id}`,
      title: track.customTitle || track.title,
      source: 'local',
      duration: '',
      url: track.fileUrl,
    }));

  const onlineFavoriteTracks = ytFavorites.map((item) => ({
    id: `online:${item.id}`,
    title: item.title,
    source: 'online',
    duration: item.duration || '',
    url: item.url || '',
  }));

  return [...localFavoriteTracks, ...onlineFavoriteTracks];
}

async function syncFavoritesToCloud() {
  if (!firebaseClient || !currentUser) return;
  try {
    await firebaseClient.setFavorites(currentUser.uid, collectCloudFavorites());
  } catch (error) {
    console.error(error);
    setAuthStatus('Failed to sync favorites');
  }
}

async function pushHistoryToCloud(entry) {
  if (!firebaseClient || !currentUser || !entry) return;
  try {
    await firebaseClient.addHistoryItem(currentUser.uid, entry);
  } catch (error) {
    console.error(error);
    setAuthStatus('Failed to sync history');
  }
}

function makeHistoryEntry({ id, title, artist = '', source = 'local' }) {
  return { id, title, artist, source, playedAt: Date.now() };
}

function applyCloudFavoritesToUi() {
  if (!currentUserDoc || !Array.isArray(currentUserDoc.favorites)) return;
  ytFavorites = currentUserDoc.favorites
    .filter((item) => item.source === 'online')
    .map((item) => ({
      id: (item.id || '').replace(/^online:/, ''),
      title: item.title || '',
      duration: item.duration || '',
      url: item.url || '',
      description: '',
    }));
  renderFavorites();
}

function bindAuthModalEvents() {
  profileBtn.addEventListener('click', openAuthModal);
  authCloseBtn.addEventListener('click', closeAuthModal);
  authBackdrop.addEventListener('click', closeAuthModal);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !authModal.hidden) closeAuthModal();
  });
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

function parseDurationToSeconds(durationText) {
  if (!durationText) return 0;
  const raw = String(durationText).trim();
  if (!raw) return 0;
  const parts = raw.split(':').map((x) => Number(x));
  if (parts.some((x) => Number.isNaN(x))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function isGoodRecommendationCandidate(item) {
  const durationSec = parseDurationToSeconds(item.duration);
  if (!durationSec || durationSec < 60 || durationSec > 600) return false;
  const title = (item.title || '').toLowerCase();
  return !BLOCKED_TITLE_TERMS.some((term) => title.includes(term));
}

function slightShuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.max(0, i - Math.floor(Math.random() * 2));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildRecommendationQueries() {
  const entries = Object.entries(behaviorStore.tracks)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => computeSignalScore(b) - computeSignalScore(a));

  if (!entries.length) return [];

  const recentKeys = new Set(behaviorStore.recent.slice(0, 10));
  const focusEntries = entries.filter((entry) => recentKeys.has(entry.key) || entry.liked).slice(0, 10);
  const source = focusEntries.length ? focusEntries : entries.slice(0, 10);

  const artistScores = new Map();
  source.forEach((entry) => {
    const artist = normalizeSpaces(entry.artist || parseArtistFromTitle(entry.title));
    if (!artist) return;
    artistScores.set(artist, (artistScores.get(artist) || 0) + computeSignalScore(entry));
  });

  const topArtists = [...artistScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([artist]) => artist);
  if (!topArtists.length) return [];

  const templates = ['similar artists', 'type beat', 'style', 'related artists', 'best tracks'];
  const queries = [];
  topArtists.forEach((artist) => {
    templates.forEach((suffix) => queries.push(`${artist} ${suffix}`));
  });

  return queries.slice(0, MAX_QUERY_COUNT);
}

async function searchWithCache(query) {
  const cacheItem = recommendationCache[query.toLowerCase()];
  if (cacheItem && Date.now() - cacheItem.savedAt < CACHE_TTL_MS && Array.isArray(cacheItem.items)) {
    return cacheItem.items;
  }

  const items = (await api.ytSearch(query)).slice(0, 5);
  recommendationCache[query.toLowerCase()] = { savedAt: Date.now(), items };
  persistRecommendationCache();
  return items;
}

function createForYouTrackItem(item, index) {
  const li = document.createElement('li');
  li.className = 'for-you-item';
  const info = document.createElement('div');
  info.className = 'for-you-meta';
  info.innerHTML = `<strong>${index + 1}. ${item.title}</strong><small>${item.duration || '—'}</small>`;

  const actions = document.createElement('div');
  actions.className = 'for-you-actions';

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
    syncFavoritesToCloud();
  });

  actions.append(play, fav);
  li.append(info, actions);
  return li;
}

async function renderForYou() {
  if (!forYouListEl) return;
  if (forYouLoading) return;
  if (!forYouDirty && forYouListEl.childElementCount > 0) return;
  forYouLoading = true;

  forYouListEl.innerHTML = '<li>Подбираем рекомендации…</li>';
  const queries = buildRecommendationQueries();
  if (!queries.length) {
    forYouListEl.innerHTML = '<li>Слушай треки и добавляй в избранное — тут появятся персональные рекомендации.</li>';
    forYouLoading = false;
    forYouDirty = false;
    return;
  }

  const merged = [];
  const seenIds = new Set();
  for (const query of queries) {
    const items = await searchWithCache(query);
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      if (!isGoodRecommendationCandidate(item)) continue;
      seenIds.add(item.id);
      merged.push(item);
      if (merged.length >= MAX_RECOMMENDED_TRACKS * 2) break;
    }
    if (merged.length >= MAX_RECOMMENDED_TRACKS * 2) break;
  }

  const finalItems = slightShuffle(merged).slice(0, MAX_RECOMMENDED_TRACKS);

  forYouListEl.innerHTML = '';
  if (!finalItems.length) {
    forYouListEl.innerHTML = '<li>Недостаточно релевантных треков. Продолжай слушать — рекомендации улучшатся.</li>';
    forYouLoading = false;
    forYouDirty = false;
    return;
  }

  finalItems.forEach((item, index) => forYouListEl.append(createForYouTrackItem(item, index)));

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
    audio.play().catch(() => {});
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
      if (currentPlayingId === `local:${track.id}`) li.classList.add('active');
      li.addEventListener('click', () => playTrack(i));
      li.addEventListener('mouseenter', () => createPreparedAudio(`local:${track.id}`, track.fileUrl));
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
  currentSourceType = 'local';
  currentPlayingId = `local:${track.id}`;
  currentOnlineQueue = [];
  currentOnlineIndex = -1;
  const prepared = createPreparedAudio(`local:${track.id}`, track.fileUrl);
  if (prepared && !prepared.ready) setPlayStatus('Loading...');
  audio.src = prepared?.src || track.fileUrl;
  await ensureAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  audio.currentTime = 0;
  audio.play().catch(() => {});
  fadeInCurrentTrack();
  setPlayStatus('');

  const displayTitle = track.customTitle || track.title;
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
  pushHistoryToCloud(makeHistoryEntry({
    id: `local:${track.id}`,
    title: displayTitle,
    artist: parseArtistFromTitle(displayTitle),
    source: 'local',
  }));
  renderTracks();
  renderYtResults(currentYtResults);
}

async function playYoutubeResult(item, queue = null, index = -1) {
  currentSourceType = 'online';
  currentPlayingId = `yt:${item.id}`;
  if (Array.isArray(queue)) {
    currentOnlineQueue = queue;
    currentOnlineIndex = index;
  }
  await ensureAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  const cacheKey = `yt:${item.id}`;
  let prepared = getPreparedAudio(cacheKey);
  if (!prepared) {
    setPlayStatus('Loading...');
    prepared = await prepareYoutubeTrack(item, 'high');
  } else if (!prepared.ready) {
    setPlayStatus('Loading...');
  }
  audio.src = prepared?.src || '';
  audio.currentTime = 0;
  audio.play().catch(() => {});
  fadeInCurrentTrack();
  setPlayStatus('');
  miniTitle.textContent = item.title;
  miniSub.textContent = 'Online stream';
  setPlaybackVisualState(true);
  updateBehaviorEntry({
    title: item.title,
    artist: item.author || parseArtistFromTitle(item.title),
    played: true,
  });
  pushHistoryToCloud(makeHistoryEntry({
    id: `online:${item.id}`,
    title: item.title,
    artist: item.author || parseArtistFromTitle(item.title),
    source: 'online',
  }));
  renderTracks();
  renderYtResults(currentOnlineQueue.length ? currentOnlineQueue : currentYtResults);
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'for-you') renderForYou();
}

playBtn.addEventListener('click', togglePlayback);
autoPlayNextBtn.addEventListener('click', () => {
  autoPlayNextEnabled = !autoPlayNextEnabled;
  autoPlayNextBtn.classList.toggle('active', autoPlayNextEnabled);
});
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
  syncFavoritesToCloud();
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

function renderYtResults(results) {
  currentYtResults = Array.isArray(results) ? results : [];
  ytResultsEl.innerHTML = '';

  if (!currentYtResults.length) {
    ytResultsEl.innerHTML = '<li class="yt-item">Ничего не найдено</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  currentYtResults.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'yt-item';
    li.style.cursor = 'pointer';
    if (currentPlayingId === `yt:${item.id}`) li.classList.add('active');

    const info = document.createElement('div');
    info.innerHTML = `<strong>${item.title}</strong><br/><small>${item.author || ''} ${item.duration ? '• ' + item.duration : ''}</small>`;

    const actions = document.createElement('div');
    actions.className = 'yt-actions';

    const play = document.createElement('button');
    play.textContent = 'Play';
    play.addEventListener('click', (event) => {
      event.stopPropagation();
      playYoutubeResult(item, currentYtResults, index);
    });

    const fav = document.createElement('button');
    fav.textContent = 'Add to favorites';
    fav.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!ytFavorites.some((x) => x.id === item.id)) ytFavorites.push({ ...item, description: '' });
      updateBehaviorEntry({
        title: item.title,
        artist: item.author || parseArtistFromTitle(item.title),
        liked: true,
        played: false,
      });
      renderFavorites();
      syncFavoritesToCloud();
      switchTab('favorites');
    });

    actions.append(play, fav);
    li.append(info, actions);
    li.addEventListener('click', () => playYoutubeResult(item, currentYtResults, index));
    li.addEventListener('mouseenter', () => scheduleHoverPreload(item));
    li.addEventListener('mouseleave', () => cancelHoverPreload(item));
    fragment.append(li);
  });
  ytResultsEl.append(fragment);
}

document.getElementById('ytSearchBtn').addEventListener('click', async () => {
  const query = document.getElementById('ytSearchInput').value.trim();
  ytResultsEl.innerHTML = '';
  if (!query) return;
  const results = (await api.ytSearch(query)).slice(0, 30);
  renderYtResults(results);

  currentYtResults.slice(0, 3).forEach((item) => {
    prepareYoutubeTrack(item, 'normal').catch(() => {});
  });
  cleanupPreparedCache();
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
  if (autoPlayNextEnabled && currentSourceType === 'online' && currentOnlineQueue.length) {
    const nextIndex = currentOnlineIndex + 1;
    if (nextIndex >= 0 && nextIndex < currentOnlineQueue.length) {
      playYoutubeResult(currentOnlineQueue[nextIndex], currentOnlineQueue, nextIndex);
      return;
    }
  }
  setPlaybackVisualState(false);
  renderTracks();
  renderYtResults(currentOnlineQueue.length ? currentOnlineQueue : currentYtResults);
});

audio.addEventListener('pause', () => setPlaybackVisualState(false));
audio.addEventListener('play', () => setPlaybackVisualState(true));
audio.addEventListener('canplay', () => setPlayStatus(''));

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
    syncFavoritesToCloud();
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
  syncFavoritesToCloud();
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

async function handleAuthState(user) {
  currentUser = user || null;
  if (!firebaseClient || !currentUser) {
    currentUserDoc = null;
    ytFavorites = [];
    updateAuthUi(null);
    renderFavorites();
    return;
  }

  try {
    currentUserDoc = await firebaseClient.ensureUserDocument(currentUser, currentUser.displayName || '');
    updateAuthUi(currentUserDoc);
    applyCloudFavoritesToUi();
    forYouDirty = true;
    renderFavorites();
  } catch (error) {
    console.error(error);
    setAuthStatus('Unable to load cloud profile');
  }
}

function initializeAuthSystem() {
  if (!firebaseClient) {
    setAuthStatus('Firebase not initialized');
    return;
  }

  bindAuthModalEvents();

  firebaseClient.onAuthStateChanged((user) => {
    handleAuthState(user);
  });

  registerBtn.addEventListener('click', async () => {
    try {
      await firebaseClient.register(
        authEmailInput.value.trim(),
        authPasswordInput.value,
        authNameInput.value.trim(),
      );
      setStoredNickname(authNameInput.value.trim());
      applyProfileVisuals();
      authPasswordInput.value = '';
      setAuthStatus('Registration successful');
    } catch (error) {
      console.error(error);
      setAuthStatus(error.message || 'Registration failed');
    }
  });

  loginBtn.addEventListener('click', async () => {
    try {
      await firebaseClient.login(authEmailInput.value.trim(), authPasswordInput.value);
      authPasswordInput.value = '';
      applyProfileVisuals();
      setAuthStatus('Login successful');
    } catch (error) {
      console.error(error);
      setAuthStatus(error.message || 'Login failed');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await firebaseClient.logout();
      setAuthStatus('Logged out');
      closeAuthModal();
    } catch (error) {
      console.error(error);
      setAuthStatus(error.message || 'Logout failed');
    }
  });

  uploadAvatarBtn.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    try {
      const avatarBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setStoredAvatar(avatarBase64);
      applyProfileVisuals();
      setAuthStatus('Avatar updated');
    } catch (error) {
      console.error(error);
      setAuthStatus(error.message || 'Avatar upload failed');
    }
  });

  saveProfileBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
      const nickname = profileNicknameInput.value.trim();
      setStoredNickname(nickname);
      await firebaseClient.updateUserProfile(currentUser.uid, { nickname });
      currentUserDoc = { ...(currentUserDoc || {}), nickname, email: currentUser.email || '' };
      updateAuthUi(currentUserDoc);
      setAuthStatus('Profile saved');
    } catch (error) {
      console.error(error);
      setAuthStatus(error.message || 'Failed to save profile');
    }
  });
}

api.getMusicDir().then((dir) => {
  musicDirHint = dir;
  renderTracks();
}).catch(() => {});

applyProfileVisuals();
initializeAuthSystem();
refreshTracks();
switchTab('home');
setEqValues(presets.flat);
setPlaybackVisualState(false);
setFavoriteButtonState(false);
refreshIcons();

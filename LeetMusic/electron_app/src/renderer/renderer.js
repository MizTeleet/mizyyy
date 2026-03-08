const api = window.leetMusicApi;


const YT_AUDIO_INSTANCE = 'https://invidious.projectsegfau.lt';

function buildYoutubeAudioUrlFromVideo(videoUrl) {
  try {
    const parsed = new URL(videoUrl);
    const videoId = parsed.searchParams.get('v') || '';
    if (!videoId) return '';
    return `${YT_AUDIO_INSTANCE}/latest_version?id=${encodeURIComponent(videoId)}&itag=140`;
  } catch {
    return '';
  }
}

const state = {
  tracks: [],
  index: -1,
  playing: false,
  selectedFavoriteId: null,
  searchResults: [],
  searchRequestId: 0,
};

const el = {
  audio: document.getElementById('audio'),
  status: document.getElementById('status'),
  trackList: document.getElementById('trackList'),
  searchResults: document.getElementById('searchResults'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchStatus: document.getElementById('searchStatus'),
  favList: document.getElementById('favList'),
  nowTitle: document.getElementById('nowTitle'),
  nowSub: document.getElementById('nowSub'),
  miniTitle: document.getElementById('miniTitle'),
  miniSub: document.getElementById('miniSub'),
  playBtn: document.getElementById('playBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  favToggleBtn: document.getElementById('favToggleBtn'),
  volume: document.getElementById('volume'),
  progress: document.getElementById('progress'),
  time: document.getElementById('time'),
  importNavBtn: document.getElementById('importNavBtn'),
  fogOverlay: document.getElementById('fogOverlay'),
  favTitleInput: document.getElementById('favTitleInput'),
  favDescInput: document.getElementById('favDescInput'),
  favCoverPreview: document.getElementById('favCoverPreview'),
  pickCoverBtn: document.getElementById('pickCoverBtn'),
  saveFavBtn: document.getElementById('saveFavBtn'),
  exportFavBtn: document.getElementById('exportFavBtn'),
  eqModal: document.getElementById('eqModal'),
  eqCloseBtn: document.getElementById('eqCloseBtn'),
  eqCloseBackdrop: document.getElementById('eqCloseBackdrop'),
  eqMid: document.getElementById('eqMid'),
  eqBass: document.getElementById('eqBass'),
  eqTreble: document.getElementById('eqTreble'),
  eqVocal: document.getElementById('eqVocal'),
};

function currentTrack() {
  return state.tracks[state.index] || null;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function renderTracks() {
  el.trackList.innerHTML = '';
  state.tracks.forEach((track, index) => {
    const li = document.createElement('li');
    li.textContent = track.customTitle || track.title;
    li.className = index === state.index ? 'active' : '';
    li.addEventListener('click', () => playIndex(index));
    el.trackList.appendChild(li);
  });

  el.favList.innerHTML = '';
  state.tracks
    .filter((track) => track.favorite)
    .forEach((track) => {
      const li = document.createElement('li');
      li.textContent = track.customTitle || track.title;
      li.className = track.id === state.selectedFavoriteId ? 'active' : '';
      li.addEventListener('click', () => {
        state.selectedFavoriteId = track.id;
        fillFavoriteEditor(track);
        renderTracks();
      });
      el.favList.appendChild(li);
    });
}

function updateNowPlaying() {
  const track = currentTrack();
  if (!track) {
    el.nowTitle.textContent = 'Выберите трек';
    el.nowSub.textContent = 'LeetMusic Desktop';
    el.miniTitle.textContent = 'LeetMusic';
    el.miniSub.textContent = 'Оффлайн плеер';
    return;
  }

  const title = track.customTitle || track.title;
  el.nowTitle.textContent = title;
  el.nowSub.textContent = track.description || track.name;
  el.miniTitle.textContent = title;
  el.miniSub.textContent = track.name;
  el.favToggleBtn.classList.toggle('accent', track.favorite);
}

async function loadTracks() {
  state.tracks = await api.listTracks();
  if (state.index >= state.tracks.length) state.index = -1;
  renderTracks();
  updateNowPlaying();
  const musicDir = await api.getMusicDir();
  el.status.textContent = `Треков: ${state.tracks.length} • ${musicDir}`;
}

function playIndex(index) {
  const track = state.tracks[index];
  if (!track) return;
  state.index = index;
  el.audio.src = track.fileUrl;
  el.audio.play();
  state.playing = true;
  el.playBtn.textContent = '⏸';
  el.fogOverlay.classList.add('playing');
  renderTracks();
  updateNowPlaying();
}

function togglePlay() {
  if (state.index === -1 && state.tracks.length) {
    playIndex(0);
    return;
  }

  if (el.audio.paused) {
    el.audio.play();
    state.playing = true;
    el.playBtn.textContent = '⏸';
    el.fogOverlay.classList.add('playing');
  } else {
    el.audio.pause();
    state.playing = false;
    el.playBtn.textContent = '▶';
    el.fogOverlay.classList.remove('playing');
  }
}

function nextTrack() {
  if (!state.tracks.length) return;
  const next = (state.index + 1) % state.tracks.length;
  playIndex(next);
}

function prevTrack() {
  if (!state.tracks.length) return;
  const prev = (state.index - 1 + state.tracks.length) % state.tracks.length;
  playIndex(prev);
}

function fillFavoriteEditor(track) {
  el.favTitleInput.value = track.customTitle || track.title;
  el.favDescInput.value = track.description || '';
  el.favCoverPreview.src = track.coverPath || '';
}

async function toggleFavorite() {
  const track = currentTrack();
  if (!track) return;
  const updated = await api.saveTrackMeta(track.id, { favorite: !track.favorite });
  Object.assign(track, updated);
  state.selectedFavoriteId = track.favorite ? track.id : null;
  renderTracks();
  updateNowPlaying();
}

async function saveFavoriteMeta() {
  const track = state.tracks.find((item) => item.id === state.selectedFavoriteId) || currentTrack();
  if (!track) return;

  const updated = await api.saveTrackMeta(track.id, {
    customTitle: el.favTitleInput.value.trim(),
    description: el.favDescInput.value.trim(),
    coverPath: el.favCoverPreview.src || '',
    favorite: true,
  });

  Object.assign(track, updated);
  state.selectedFavoriteId = track.id;
  renderTracks();
  updateNowPlaying();
}

async function pickCover() {
  const coverPath = await api.pickCover();
  if (coverPath) el.favCoverPreview.src = coverPath;
}

async function exportFavoriteCard() {
  const track = state.tracks.find((item) => item.id === state.selectedFavoriteId) || currentTrack();
  if (!track) return;

  await api.exportTrackCard({
    id: track.id,
    title: el.favTitleInput.value.trim() || track.customTitle || track.title,
    description: el.favDescInput.value.trim() || track.description || '',
    coverPath: el.favCoverPreview.src || track.coverPath || '',
    sourceFile: track.name,
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
  const target = document.getElementById(`tab-${tab}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn[data-tab]').forEach((btn) => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

function openEq() {
  el.eqModal.hidden = false;
}

function closeEq() {
  el.eqModal.hidden = true;
}

function applyPreset(preset) {
  const presets = {
    flat: { bass: 0, mid: 0, treble: 0, vocal: 0 },
    bass: { bass: 9, mid: -2, treble: 2, vocal: 0 },
    vocal: { bass: -1, mid: 4, treble: 2, vocal: 6 },
    treble: { bass: -2, mid: 1, treble: 8, vocal: 2 },
  };
  const cfg = presets[preset] || presets.flat;
  el.eqBass.value = cfg.bass;
  el.eqMid.value = cfg.mid;
  el.eqTreble.value = cfg.treble;
  el.eqVocal.value = cfg.vocal;
}

function safeFileExt(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.includes('.') ? pathname.slice(pathname.lastIndexOf('.')) : '.m4a';
    return ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'].includes(ext.toLowerCase()) ? ext : '.m4a';
  } catch {
    return '.m4a';
  }
}

function renderSearchResults() {
  el.searchResults.innerHTML = '';
  state.searchResults.forEach((result) => {
    const li = document.createElement('li');

    const meta = document.createElement('div');
    meta.className = 'search-meta';

    const title = document.createElement('div');
    title.className = 'search-track-title';
    title.textContent = result.trackName;

    const artist = document.createElement('div');
    artist.className = 'search-track-artist';
    artist.textContent = result.duration ? `${result.artistName} • ${result.duration}` : result.artistName;

    meta.appendChild(title);
    meta.appendChild(artist);

    const actions = document.createElement('div');
    actions.className = 'search-actions';

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => {
      if (!result.streamUrl) return;
      el.audio.src = result.streamUrl;
      el.audio.play();
      state.playing = true;
      state.index = -1;
      el.playBtn.textContent = '⏸';
      el.fogOverlay.classList.add('playing');
      el.nowTitle.textContent = result.trackName;
      el.nowSub.textContent = result.artistName;
      el.miniTitle.textContent = result.trackName;
      el.miniSub.textContent = result.artistName;
      renderTracks();
    });

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.addEventListener('click', async () => {
      await downloadSearchResult(result, false);
    });

    const favBtn = document.createElement('button');
    favBtn.textContent = 'Add ❤';
    favBtn.addEventListener('click', async () => {
      await downloadSearchResult(result, true);
    });

    actions.appendChild(playBtn);
    actions.appendChild(downloadBtn);
    actions.appendChild(favBtn);

    li.appendChild(meta);
    li.appendChild(actions);
    el.searchResults.appendChild(li);
  });
}

async function downloadSearchResult(result, markFavorite) {
  if (!result.streamUrl) {
    el.searchStatus.textContent = 'У результата нет URL для воспроизведения.';
    return;
  }

  el.searchStatus.textContent = `Скачиваю: ${result.trackName}...`;
  try {
    const downloaded = await api.downloadOnlineTrack({
      url: result.streamUrl,
      title: result.trackName,
      artist: result.artistName,
      ext: safeFileExt(result.streamUrl),
    });

    await loadTracks();
    const downloadedTrack = state.tracks.find((track) => track.name === downloaded.fileName);
    if (downloadedTrack && markFavorite) {
      const updated = await api.saveTrackMeta(downloadedTrack.id, {
        favorite: true,
        customTitle: result.trackName,
        description: result.artistName,
      });
      Object.assign(downloadedTrack, updated);
      state.selectedFavoriteId = downloadedTrack.id;
      renderTracks();
    }

    el.searchStatus.textContent = `Скачано: ${downloaded.fileName}`;
  } catch (error) {
    el.searchStatus.textContent = `Ошибка скачивания: ${error.message}`;
  }
}

async function searchOnlineTracks(query) {
  const requestId = ++state.searchRequestId;
  const term = query.trim();
  if (!term) {
    state.searchResults = [];
    renderSearchResults();
    el.searchStatus.textContent = 'Введите название трека для поиска.';
    return;
  }

  el.searchStatus.textContent = `Ищу: ${term}...`;

  try {
    const results = await api.searchOnlineTracks(term);

    if (requestId !== state.searchRequestId) return;

    state.searchResults = Array.isArray(results)
      ? results
          .filter((item) => item && typeof item === 'object')
          .map((item) => {
            const rawUrl = typeof item.url === 'string' ? item.url : '';

            return {
              trackName: typeof item.title === 'string' ? item.title : '',
              artistName: typeof item.author === 'string' ? item.author : 'Unknown',
              duration: typeof item.duration === 'string' ? item.duration : '',
              videoUrl: rawUrl,
              streamUrl: rawUrl ? buildYoutubeAudioUrlFromVideo(rawUrl) : '',
            };
          })
          .filter((item) => item.trackName && item.videoUrl && item.streamUrl)
      : [];

    renderSearchResults();
    el.searchStatus.textContent = `Найдено: ${state.searchResults.length}`;
  } catch (error) {
    if (requestId !== state.searchRequestId) return;
    state.searchResults = [];
    renderSearchResults();
    el.searchStatus.textContent = `Ошибка поиска: ${error.message}`;
  }
}

async function init() {
  await loadTracks();
  el.searchStatus.textContent = 'Введите название трека для поиска.';

  el.importNavBtn.addEventListener('click', async () => {
    await api.importTracks();
    await loadTracks();
  });

  document.querySelectorAll('.nav-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('openEqBtn').addEventListener('click', openEq);
  document.getElementById('openEqBtn2').addEventListener('click', openEq);
  el.eqCloseBtn.addEventListener('click', closeEq);
  el.eqCloseBackdrop.addEventListener('click', closeEq);

  document.querySelectorAll('.eq-presets button').forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  el.searchBtn.addEventListener('click', () => searchOnlineTracks(el.searchInput.value));
  el.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchOnlineTracks(el.searchInput.value);
  });

  el.playBtn.addEventListener('click', togglePlay);
  el.nextBtn.addEventListener('click', nextTrack);
  el.prevBtn.addEventListener('click', prevTrack);
  el.favToggleBtn.addEventListener('click', toggleFavorite);
  el.pickCoverBtn.addEventListener('click', pickCover);
  el.saveFavBtn.addEventListener('click', saveFavoriteMeta);
  el.exportFavBtn.addEventListener('click', exportFavoriteCard);

  el.volume.addEventListener('input', () => {
    el.audio.volume = Number(el.volume.value) / 100;
  });
  el.audio.volume = Number(el.volume.value) / 100;

  el.audio.addEventListener('timeupdate', () => {
    const { currentTime, duration } = el.audio;
    const progress = duration ? (currentTime / duration) * 100 : 0;
    el.progress.value = String(progress || 0);
    el.time.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  });

  el.progress.addEventListener('input', () => {
    const { duration } = el.audio;
    if (!duration) return;
    el.audio.currentTime = (Number(el.progress.value) / 100) * duration;
  });

  el.audio.addEventListener('ended', nextTrack);
}

init();

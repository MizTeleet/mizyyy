(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyCo7CXDAC1ppbz59V70ztjosjug25_00nA",
    authDomain: "leetmusic-66c59.firebaseapp.com",
    projectId: "leetmusic-66c59",
    storageBucket: "leetmusic-66c59.firebasestorage.app",
    messagingSenderId: "197371193351",
    appId: "1:197371193351:web:69fb6a013b330a257de2a2",
  };

  firebase.initializeApp(firebaseConfig);
  console.log('[firebase] initialized');

  const auth = firebase.auth();
  const db = firebase.firestore();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

  function userRef(uid) {
    return db.collection('users').doc(uid);
  }

  function favoritesCol(uid) {
    return db.collection('favorites').where('userId', '==', uid);
  }

  function playlistsCol(uid) {
    return db.collection('playlists').where('userId', '==', uid);
  }

  async function ensureUserDocument(user, nickname = '') {
    if (!user) return null;
    const ref = userRef(user.uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      await ref.set({
        uid: user.uid,
        nickname: nickname || user.displayName || '',
        email: user.email || '',
        avatar: user.photoURL || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await ref.set({
        email: user.email || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const updated = await ref.get();
    return updated.data() || null;
  }

  async function register(email, password, nickname) {
    console.log('[firebase] register start');
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    if (nickname) await credential.user.updateProfile({ displayName: nickname });
    await ensureUserDocument(credential.user, nickname || '');
    return credential.user;
  }

  async function login(email, password) {
    console.log('[firebase] login start');
    const credential = await auth.signInWithEmailAndPassword(email, password);
    await ensureUserDocument(credential.user);
    return credential.user;
  }

  async function logout() {
    await auth.signOut();
  }

  function onAuthStateChanged(handler) {
    return auth.onAuthStateChanged(handler);
  }

  async function getUserDocument(uid) {
    if (!uid) return null;
    const snapshot = await userRef(uid).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async function updateUserProfile(uid, patch) {
    if (!uid) return;
    await userRef(uid).set({
      ...patch,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async function setFavorites(uid, favorites) {
    const batch = db.batch();
    const snapshot = await favoritesCol(uid).get();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    (favorites || []).forEach((item) => {
      const docRef = db.collection('favorites').doc();
      batch.set(docRef, {
        userId: uid,
        trackId: item.id || '',
        title: item.title || '',
        artist: item.artist || '',
        source: item.source || 'youtube',
        youtubeUrl: item.youtubeUrl || item.url || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  async function addHistoryItem(uid, item) {
    const doc = await getUserDocument(uid);
    const existing = Array.isArray(doc?.history) ? doc.history : [];
    const deduped = [item, ...existing.filter((entry) => entry?.id !== item?.id)].slice(0, 20);
    await updateUserProfile(uid, { history: deduped });
  }

  function listenUserProfile(uid, handler) {
    return userRef(uid).onSnapshot((snapshot) => {
      handler(snapshot.exists ? snapshot.data() : null);
    });
  }

  function listenFavorites(uid, handler) {
    return favoritesCol(uid).onSnapshot((snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      handler(items);
    });
  }

  async function createPlaylist(uid, name) {
    const ref = await db.collection('playlists').add({
      userId: uid,
      name: name || 'My Playlist',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async function renamePlaylist(playlistId, name) {
    await db.collection('playlists').doc(playlistId).set({ name }, { merge: true });
  }

  async function deletePlaylist(playlistId) {
    const tracks = await db.collection('playlists').doc(playlistId).collection('tracks').get();
    const batch = db.batch();
    tracks.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.collection('playlists').doc(playlistId));
    await batch.commit();
  }

  async function addTrackToPlaylist(playlistId, track) {
    await db.collection('playlists').doc(playlistId).collection('tracks').add({
      trackId: track.id || '',
      title: track.title || '',
      artist: track.artist || '',
      source: track.source || 'youtube',
      youtubeUrl: track.youtubeUrl || track.url || '',
      addedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function removeTrackFromPlaylist(playlistId, docId) {
    await db.collection('playlists').doc(playlistId).collection('tracks').doc(docId).delete();
  }

  function listenPlaylists(uid, handler) {
    return playlistsCol(uid).onSnapshot(async (snapshot) => {
      const playlists = await Promise.all(snapshot.docs.map(async (doc) => {
        const tracksSnap = await db.collection('playlists').doc(doc.id).collection('tracks').get();
        return {
          id: doc.id,
          ...doc.data(),
          tracks: tracksSnap.docs.map((x) => ({ id: x.id, ...x.data() })),
        };
      }));
      handler(playlists);
    });
  }

  window.firebaseClient = {
    auth,
    register,
    login,
    logout,
    onAuthStateChanged,
    ensureUserDocument,
    getUserDocument,
    updateUserProfile,
    setFavorites,
    addHistoryItem,
    listenUserProfile,
    listenFavorites,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    listenPlaylists,
  };
})();

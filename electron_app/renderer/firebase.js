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

  const auth = firebase.auth();
  const db = firebase.firestore();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

  function userRef(uid) {
    return db.collection('users').doc(uid);
  }

  async function ensureUserDocument(user, nickname = '') {
    if (!user) return null;
    const ref = userRef(user.uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      await ref.set({
        nickname: nickname || user.displayName || '',
        email: user.email || '',
        avatarUrl: user.photoURL || '',
        favorites: [],
        history: [],
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
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    if (nickname) await credential.user.updateProfile({ displayName: nickname });
    await ensureUserDocument(credential.user, nickname || '');
    return credential.user;
  }

  async function login(email, password) {
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
    await updateUserProfile(uid, { favorites: favorites || [] });
  }

  async function addHistoryItem(uid, item) {
    const doc = await getUserDocument(uid);
    const existing = Array.isArray(doc?.history) ? doc.history : [];
    const deduped = [item, ...existing.filter((entry) => entry?.id !== item?.id)].slice(0, 20);
    await updateUserProfile(uid, { history: deduped });
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
  };
})();

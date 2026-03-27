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
  const storage = firebase.storage();

  async function ensureUserProfile(user, patch = {}) {
    if (!user) return null;
    const userRef = db.collection('users').doc(user.uid);
    const baseProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      avatarUrl: user.photoURL || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set({ profile: { ...baseProfile, ...patch } }, { merge: true });
    const snapshot = await userRef.get();
    return snapshot.data()?.profile || null;
  }

  async function register(email, password, displayName) {
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    if (displayName) await credential.user.updateProfile({ displayName });
    await ensureUserProfile(credential.user, { displayName: displayName || '' });
    return credential.user;
  }

  async function login(email, password) {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    await ensureUserProfile(credential.user);
    return credential.user;
  }

  async function logout() {
    await auth.signOut();
  }

  function onAuthStateChanged(handler) {
    return auth.onAuthStateChanged(handler);
  }

  async function getUserProfile(uid) {
    if (!uid) return null;
    const snapshot = await db.collection('users').doc(uid).get();
    return snapshot.exists ? snapshot.data()?.profile || null : null;
  }

  async function uploadAvatar(file) {
    const user = auth.currentUser;
    if (!user || !file) throw new Error('User not authenticated');
    const avatarRef = storage.ref().child(`avatars/${user.uid}/${Date.now()}_${file.name}`);
    await avatarRef.put(file);
    const avatarUrl = await avatarRef.getDownloadURL();
    await user.updateProfile({ photoURL: avatarUrl });
    await ensureUserProfile(user, { avatarUrl });
    return avatarUrl;
  }

  async function saveUserState(payload) {
    const user = auth.currentUser;
    if (!user) return;
    await db.collection('users').doc(user.uid).set({
      playerState: {
        ...payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });
  }

  async function loadUserState(uid) {
    if (!uid) return null;
    const snapshot = await db.collection('users').doc(uid).get();
    if (!snapshot.exists) return null;
    return snapshot.data()?.playerState || null;
  }

  window.firebaseClient = {
    auth,
    register,
    login,
    logout,
    onAuthStateChanged,
    ensureUserProfile,
    getUserProfile,
    uploadAvatar,
    saveUserState,
    loadUserState,
  };
})();

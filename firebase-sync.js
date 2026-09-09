import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  getDocFromServer 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Safe string encoder for Firestore document IDs
function encodeDocId(str) {
  if (!str) return 'id_' + Date.now();
  return encodeURIComponent(str.trim().slice(0, 100)).replace(/%/g, '_');
}

class FirebaseSyncService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.currentUser = null;
    this.isInitialized = false;
    this.isSyncing = false;
    this.statusListeners = [];
    this.init();
  }

  async init() {
    try {
      let config = null;
      try {
        const res = await fetch('/firebase-applet-config.json');
        if (res.ok) {
          config = await res.json();
        }
      } catch (e) {
        console.warn("[FirebaseSync] Could not fetch config file, using fallback:", e);
      }

      if (!config) {
        config = {
          projectId: "influential-acumen-wpthm",
          appId: "1:452090137816:web:bafb6f506ca4e6dd499bad",
          apiKey: "AIzaSyAacLlnG1x1kS3CQzleXXFqMyEhPE_gRSo",
          authDomain: "influential-acumen-wpthm.firebaseapp.com",
          firestoreDatabaseId: "ai-studio-easyengtraining-e5d90611-83a2-4adb-baeb-0a1dc75d353b",
          storageBucket: "influential-acumen-wpthm.firebasestorage.app",
          messagingSenderId: "452090137816"
        };
      }

      this.app = initializeApp(config);
      this.auth = getAuth(this.app);
      
      const dbId = config.firestoreDatabaseId || "(default)";
      this.db = getFirestore(this.app, dbId);

      this.isInitialized = true;
      this.notifyStatus({ state: 'init', message: 'Firebase初期化完了' });

      // Run health test as mandated by skill
      this.testConnection();

      // Listen to auth state
      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          this.currentUser = user;
          this.notifyStatus({ 
            state: 'authenticated', 
            isAnonymous: user.isAnonymous, 
            displayName: user.displayName || user.email || 'クラウドユーザー',
            message: user.isAnonymous ? '☁️ クラウド同期中 (ゲスト)' : `☁️ ${user.displayName || user.email} で同期中` 
          });
          await this.pullAllData();
        } else {
          // Auto sign-in anonymously for zero friction
          try {
            this.notifyStatus({ state: 'signing-in', message: '☁️ 認証中...' });
            await signInAnonymously(this.auth);
          } catch (authErr) {
            console.warn("[FirebaseSync] Anonymous sign-in error:", authErr);
            this.notifyStatus({ state: 'offline', message: '📴 ローカル保存モード' });
          }
        }
      });

    } catch (err) {
      console.error("[FirebaseSync] Init error:", err);
      this.notifyStatus({ state: 'error', message: '同期エラー（ローカル保存中）' });
    }
  }

  async testConnection() {
    if (!this.db) return;
    try {
      await getDocFromServer(doc(this.db, 'test', 'connection'));
      console.log("[FirebaseSync] Firestore server connection confirmed.");
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn("[FirebaseSync] Client is offline, cached data will be used.");
      }
    }
  }

  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusListeners.push(callback);
    }
  }

  notifyStatus(status) {
    this.statusListeners.forEach(cb => {
      try { cb(status); } catch (e) { console.error(e); }
    });
  }

  async handleAuthClick() {
    if (!this.auth) return;
    if (this.currentUser && !this.currentUser.isAnonymous) {
      const confirmLogout = window.confirm(`現在 ${this.currentUser.displayName || this.currentUser.email} で同期中です。\nログアウトして匿名モードに切り替えますか？`);
      if (confirmLogout) {
        await signOut(this.auth);
        await signInAnonymously(this.auth);
      }
      return;
    }

    try {
      this.notifyStatus({ state: 'signing-in', message: 'Googleログイン中...' });
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
    } catch (err) {
      console.warn("[FirebaseSync] Google Auth cancelled or failed:", err);
      this.notifyStatus({ 
        state: 'authenticated', 
        isAnonymous: this.currentUser?.isAnonymous ?? true, 
        message: '☁️ クラウド同期中 (ゲスト)' 
      });
    }
  }

  // --- Pull Data from Cloud into LocalStorage ---
  async pullAllData() {
    if (!this.currentUser || !this.db) return;
    const uid = this.currentUser.uid;
    this.isSyncing = true;
    this.notifyStatus({ state: 'syncing', message: '🔄 クラウドデータを同期中...' });

    try {
      // 1. Sync User Profile (XP, Streak, etc.)
      const userRef = doc(this.db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const localStats = JSON.parse(localStorage.getItem('english_learning_stats_v3') || '{"xp":0,"total":0,"correct":0,"streak":0,"lastDate":"","mistakes":[]}');

      if (userSnap.exists()) {
        const cloud = userSnap.data();
        // Merge: keep highest XP and best streak
        localStats.xp = Math.max(localStats.xp || 0, cloud.xp || 0);
        localStats.total = Math.max(localStats.total || 0, cloud.totalAnswered || 0);
        localStats.correct = Math.max(localStats.correct || 0, cloud.correctCount || 0);
        localStats.streak = Math.max(localStats.streak || 0, cloud.streak || 0);
        if (!localStats.lastDate && cloud.lastDate) localStats.lastDate = cloud.lastDate;

        localStorage.setItem('english_learning_stats_v3', JSON.stringify(localStats));
        if (typeof window.updateDashboard === 'function') {
          window.updateDashboard();
        }
      } else {
        // Initial push to cloud
        await setDoc(userRef, {
          userId: uid,
          xp: localStats.xp || 0,
          streak: localStats.streak || 0,
          totalAnswered: localStats.total || 0,
          correctCount: localStats.correct || 0,
          lastDate: localStats.lastDate || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Sync Saved Weapons / Phrases Library
      const weaponsRef = collection(this.db, 'users', uid, 'weapons');
      const weaponsSnap = await getDocs(weaponsRef);
      let localLib = JSON.parse(localStorage.getItem('english_phrase_library') || '[]');

      weaponsSnap.forEach(docSnap => {
        const item = docSnap.data();
        if (item.target && !localLib.some(l => l.target === item.target)) {
          localLib.push({
            id: Date.now() + Math.random(),
            target: item.target,
            guide: item.guide || '',
            key_pattern: item.key_pattern || '',
            key_pattern_jp: item.key_pattern_jp || '',
            topic: item.topic || '',
            ai_en: item.target
          });
        }
      });
      localStorage.setItem('english_phrase_library', JSON.stringify(localLib));

      // Push local phrases that are missing from cloud
      for (const phrase of localLib) {
        if (!phrase.target) continue;
        const docId = encodeDocId(phrase.target);
        await setDoc(doc(this.db, 'users', uid, 'weapons', docId), {
          userId: uid,
          target: phrase.target,
          guide: phrase.guide || '',
          key_pattern: phrase.key_pattern || '',
          key_pattern_jp: phrase.key_pattern_jp || '',
          topic: phrase.topic || '',
          savedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 3. Sync Spaced Repetition Items
      const spacedRef = collection(this.db, 'users', uid, 'spaced_items');
      const spacedSnap = await getDocs(spacedRef);
      let localSpaced = JSON.parse(localStorage.getItem('english_spaced_items_v1') || '[]');

      spacedSnap.forEach(docSnap => {
        const item = docSnap.data();
        if (item.target && !localSpaced.some(s => s.target === item.target)) {
          localSpaced.push({
            target: item.target,
            guide: item.guide || '',
            ai_en: item.ai_en || '',
            level: item.level || 1,
            dueDate: item.dueDate || Date.now()
          });
        }
      });
      localStorage.setItem('english_spaced_items_v1', JSON.stringify(localSpaced));

      for (const sp of localSpaced) {
        if (!sp.target) continue;
        const docId = encodeDocId(sp.target);
        await setDoc(doc(this.db, 'users', uid, 'spaced_items', docId), {
          userId: uid,
          target: sp.target,
          guide: sp.guide || '',
          ai_en: sp.ai_en || '',
          level: sp.level || 1,
          dueDate: sp.dueDate || Date.now(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      this.notifyStatus({ 
        state: 'synced', 
        isAnonymous: this.currentUser.isAnonymous, 
        message: this.currentUser.isAnonymous ? '☁️ 同期完了 (ゲスト)' : `☁️ 同期完了 (${this.currentUser.displayName || '連携済'})` 
      });

    } catch (e) {
      console.warn("[FirebaseSync] Sync error:", e);
      this.notifyStatus({ state: 'synced', message: '☁️ 同期完了（キャッシュ保持）' });
    } finally {
      this.isSyncing = false;
    }
  }

  // --- Push Methods called by App Events ---

  async saveStats(stats) {
    if (!this.currentUser || !this.db) return;
    try {
      const userRef = doc(this.db, 'users', this.currentUser.uid);
      await setDoc(userRef, {
        userId: this.currentUser.uid,
        xp: stats.xp || 0,
        streak: stats.streak || 0,
        totalAnswered: stats.total || 0,
        correctCount: stats.correct || 0,
        lastDate: stats.lastDate || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("[FirebaseSync] saveStats error:", e);
    }
  }

  async saveWeapon(weapon) {
    if (!this.currentUser || !this.db || !weapon || !weapon.target) return;
    try {
      const docId = encodeDocId(weapon.target);
      const weaponRef = doc(this.db, 'users', this.currentUser.uid, 'weapons', docId);
      await setDoc(weaponRef, {
        userId: this.currentUser.uid,
        target: weapon.target,
        guide: weapon.guide || '',
        key_pattern: weapon.key_pattern || '',
        key_pattern_jp: weapon.key_pattern_jp || '',
        topic: weapon.topic || '',
        savedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("[FirebaseSync] saveWeapon error:", e);
    }
  }

  async deleteWeapon(target) {
    if (!this.currentUser || !this.db || !target) return;
    try {
      const docId = encodeDocId(target);
      const weaponRef = doc(this.db, 'users', this.currentUser.uid, 'weapons', docId);
      await deleteDoc(weaponRef);
    } catch (e) {
      console.warn("[FirebaseSync] deleteWeapon error:", e);
    }
  }

  async saveSpacedItem(item) {
    if (!this.currentUser || !this.db || !item || !item.target) return;
    try {
      const docId = encodeDocId(item.target);
      const spacedRef = doc(this.db, 'users', this.currentUser.uid, 'spaced_items', docId);
      await setDoc(spacedRef, {
        userId: this.currentUser.uid,
        target: item.target,
        guide: item.guide || '',
        ai_en: item.ai_en || '',
        level: item.level || 1,
        dueDate: item.dueDate || Date.now(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("[FirebaseSync] saveSpacedItem error:", e);
    }
  }
}

// Instantiate and expose to window
const syncService = new FirebaseSyncService();
window.fbSync = syncService;

export default syncService;

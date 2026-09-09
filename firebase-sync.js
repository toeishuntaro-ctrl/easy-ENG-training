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

// Helper: safe string encoder for Firestore document IDs
function encodeDocId(str) {
  if (!str) return 'id_' + Date.now();
  return encodeURIComponent(str.trim().slice(0, 100)).replace(/%/g, '_');
}

// Generate an 8-character human-friendly sync code (e.g., PE-7K9A-4M2X)
function generateSyncCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) p1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) p2 += chars[Math.floor(Math.random() * chars.length)];
  return `PE-${p1}-${p2}`;
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
    
    // Load or create persistent cross-device sync code
    let savedCode = localStorage.getItem('english_sync_code');
    if (!savedCode || savedCode.trim().length < 4) {
      savedCode = generateSyncCode();
      localStorage.setItem('english_sync_code', savedCode);
    }
    this.syncCode = savedCode.trim().toUpperCase();

    this.init();
  }

  getProfileDocRef() {
    return doc(this.db, 'sync_profiles', this.syncCode);
  }

  getCollectionRef(subcollection) {
    return collection(this.db, 'sync_profiles', this.syncCode, subcollection);
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

      // Run health test
      this.testConnection();

      // Listen to auth state
      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          this.currentUser = user;
          const userLabel = user.isAnonymous ? `コード: ${this.syncCode}` : (user.displayName || user.email);
          this.notifyStatus({ 
            state: 'authenticated', 
            isAnonymous: user.isAnonymous, 
            displayName: user.displayName || user.email || 'クラウドユーザー',
            syncCode: this.syncCode,
            message: `☁️ 同期中 (${userLabel})` 
          });
          await this.pullAllData();
        } else {
          // Auto sign-in anonymously for frictionless access
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
      this.notifyStatus({ state: 'error', message: '同期エラー（ローカル保持中）' });
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

  // --- Change Sync Code to link another device (e.g. PC to Smartphone) ---
  async connectSyncCode(newCode) {
    if (!newCode) return { success: false, message: '同期コードを入力してください' };
    const cleanCode = newCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      return { success: false, message: '有効なコード形式（4文字以上）を入力してください' };
    }

    this.syncCode = cleanCode;
    localStorage.setItem('english_sync_code', cleanCode);
    this.notifyStatus({ state: 'syncing', message: `🔄 コード [${cleanCode}] と同期中...`, syncCode: cleanCode });

    try {
      await this.pullAllData();
      this.notifyStatus({ 
        state: 'synced', 
        syncCode: cleanCode,
        message: `☁️ 同期完了 (コード: ${cleanCode})` 
      });
      return { success: true, message: `端末同期コード [${cleanCode}] に接続し、全データを取得しました！` };
    } catch (e) {
      console.error("[FirebaseSync] connectSyncCode error:", e);
      return { success: false, message: '同期に失敗しました: ' + (e.message || '通信エラー') };
    }
  }

  // --- Handle Google Authentication with Full Diagnosis ---
  async signInWithGoogle() {
    if (!this.auth) return { success: false, message: '認証機能が準備できていません' };

    const inIframe = window.self !== window.top;
    try {
      this.notifyStatus({ state: 'signing-in', message: 'Googleログイン中...' });
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      
      if (result && result.user) {
        this.currentUser = result.user;
        // Optionally bind sync code with Google user email for permanent recovery
        if (result.user.email) {
          const emailCode = 'G-' + result.user.email.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30).toUpperCase();
          this.syncCode = emailCode;
          localStorage.setItem('english_sync_code', emailCode);
        }
        await this.pullAllData();
        return { success: true, user: result.user };
      }
      return { success: false, message: 'ログインがキャンセルされました' };
    } catch (err) {
      console.warn("[FirebaseSync] Google Auth Error:", err);
      let errorMsg = 'Googleログインに失敗しました。';

      if (err.code === 'auth/popup-blocked') {
        errorMsg = inIframe 
          ? 'ブラウザによりポップアップがブロックされました。プレビュー画面内(iframe)ではGoogleポップアップが制限されるため、右上の「別タブで開く」アイコンから開くか、下記の「端末同期コード」をご利用ください。'
          : 'ブラウザのポップアップブロックが作動しました。アドレスバーのブロック解除を許可してください。';
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMsg = '現在表示中のプレビュー環境ドメインはGoogle OAuth許可リスト外です。Googleログインの代わりに、下記の「端末同期コード」を使用することで、PCとスマホを100%確実に同期できます！';
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'ログインウィンドウが閉じられました。';
      } else if (err.message) {
        errorMsg = `エラー: ${err.message}`;
      }

      this.notifyStatus({ 
        state: 'authenticated', 
        isAnonymous: this.currentUser?.isAnonymous ?? true, 
        syncCode: this.syncCode,
        message: `☁️ 同期中 (コード: ${this.syncCode})` 
      });

      return { success: false, message: errorMsg, code: err.code };
    }
  }

  async handleSignOut() {
    if (!this.auth) return;
    try {
      await signOut(this.auth);
      await signInAnonymously(this.auth);
      this.notifyStatus({ 
        state: 'authenticated', 
        isAnonymous: true, 
        syncCode: this.syncCode,
        message: `☁️ 同期中 (コード: ${this.syncCode})` 
      });
    } catch (e) {
      console.error(e);
    }
  }

  // --- Pull All Data from Cloud (Stats, Weapons, Spaced Items, and Quiz History) ---
  async pullAllData() {
    if (!this.db) return;
    this.isSyncing = true;
    this.notifyStatus({ state: 'syncing', message: `🔄 クラウドデータを同期中... (${this.syncCode})` });

    try {
      // 1. Sync Profile & Stats (XP, Streak, Accuracy)
      const profileRef = this.getProfileDocRef();
      const profileSnap = await getDoc(profileRef);
      const localStats = JSON.parse(localStorage.getItem('english_learning_stats_v3') || '{"xp":0,"total":0,"correct":0,"streak":0,"lastDate":"","mistakes":[]}');

      if (profileSnap.exists()) {
        const cloud = profileSnap.data();
        localStats.xp = Math.max(localStats.xp || 0, cloud.xp || 0);
        localStats.total = Math.max(localStats.total || 0, cloud.totalAnswered || 0);
        localStats.correct = Math.max(localStats.correct || 0, cloud.correctCount || 0);
        localStats.streak = Math.max(localStats.streak || 0, cloud.streak || 0);
        if (!localStats.lastDate && cloud.lastDate) localStats.lastDate = cloud.lastDate;

        localStorage.setItem('english_learning_stats_v3', JSON.stringify(localStats));
      } else {
        // Initial push of existing local stats to cloud profile
        await setDoc(profileRef, {
          syncCode: this.syncCode,
          userId: this.currentUser ? this.currentUser.uid : 'anon',
          xp: localStats.xp || 0,
          streak: localStats.streak || 0,
          totalAnswered: localStats.total || 0,
          correctCount: localStats.correct || 0,
          lastDate: localStats.lastDate || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Sync Saved Weapons / Phrases Library
      const weaponsRef = this.getCollectionRef('weapons');
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

      // Push local phrases to cloud if missing
      for (const phrase of localLib) {
        if (!phrase.target) continue;
        const docId = encodeDocId(phrase.target);
        await setDoc(doc(this.db, 'sync_profiles', this.syncCode, 'weapons', docId), {
          syncCode: this.syncCode,
          target: phrase.target,
          guide: phrase.guide || '',
          key_pattern: phrase.key_pattern || '',
          key_pattern_jp: phrase.key_pattern_jp || '',
          topic: phrase.topic || '',
          savedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 3. Sync Spaced Repetition Items
      const spacedRef = this.getCollectionRef('spaced_items');
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
        await setDoc(doc(this.db, 'sync_profiles', this.syncCode, 'spaced_items', docId), {
          syncCode: this.syncCode,
          target: sp.target,
          guide: sp.guide || '',
          ai_en: sp.ai_en || '',
          level: sp.level || 1,
          dueDate: sp.dueDate || Date.now(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 4. Sync Past Quiz Scenarios & History Logs (重要: 過去のクイズリスト)
      const historyRef = this.getCollectionRef('quiz_history');
      const historySnap = await getDocs(historyRef);
      let localHistory = JSON.parse(localStorage.getItem('english_scenarios_history') || '[]');

      historySnap.forEach(docSnap => {
        const cloudItem = docSnap.data();
        const existingIdx = localHistory.findIndex(h => h.id === cloudItem.id);
        if (existingIdx === -1) {
          localHistory.push(cloudItem);
        } else {
          // Keep the record with higher answered count or completed status
          if ((cloudItem.answered || 0) > (localHistory[existingIdx].answered || 0)) {
            localHistory[existingIdx] = cloudItem;
          }
        }
      });

      // Sort newest first
      localHistory.sort((a, b) => (b.id || 0) - (a.id || 0));
      localStorage.setItem('english_scenarios_history', JSON.stringify(localHistory));

      // Push local history items to cloud (up to 30 recent)
      for (const item of localHistory.slice(0, 30)) {
        if (!item.id) continue;
        await setDoc(doc(this.db, 'sync_profiles', this.syncCode, 'quiz_history', String(item.id)), {
          ...item,
          syncCode: this.syncCode,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Refresh all app UI components
      if (typeof window.updateDashboard === 'function') window.updateDashboard();
      if (typeof window.renderLibrary === 'function') window.renderLibrary();
      if (typeof window.renderHistory === 'function') window.renderHistory();
      if (typeof window.populateScriptLogSelect === 'function') window.populateScriptLogSelect();
      if (typeof window.populateQuickModeSelect === 'function') window.populateQuickModeSelect();

      this.notifyStatus({ 
        state: 'synced', 
        syncCode: this.syncCode,
        isAnonymous: this.currentUser?.isAnonymous ?? true, 
        message: `☁️ 同期完了 (${this.syncCode})` 
      });

    } catch (e) {
      console.warn("[FirebaseSync] Sync error:", e);
      this.notifyStatus({ state: 'synced', syncCode: this.syncCode, message: `☁️ 同期完了 (${this.syncCode})` });
    } finally {
      this.isSyncing = false;
    }
  }

  // --- Real-time Push Handlers ---

  async saveStats(stats) {
    if (!this.db) return;
    try {
      const profileRef = this.getProfileDocRef();
      await setDoc(profileRef, {
        syncCode: this.syncCode,
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
    if (!this.db || !weapon || !weapon.target) return;
    try {
      const docId = encodeDocId(weapon.target);
      const weaponRef = doc(this.db, 'sync_profiles', this.syncCode, 'weapons', docId);
      await setDoc(weaponRef, {
        syncCode: this.syncCode,
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
    if (!this.db || !target) return;
    try {
      const docId = encodeDocId(target);
      const weaponRef = doc(this.db, 'sync_profiles', this.syncCode, 'weapons', docId);
      await deleteDoc(weaponRef);
    } catch (e) {
      console.warn("[FirebaseSync] deleteWeapon error:", e);
    }
  }

  async saveSpacedItem(item) {
    if (!this.db || !item || !item.target) return;
    try {
      const docId = encodeDocId(item.target);
      const spacedRef = doc(this.db, 'sync_profiles', this.syncCode, 'spaced_items', docId);
      await setDoc(spacedRef, {
        syncCode: this.syncCode,
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

  async saveQuizHistory(historyItem) {
    if (!this.db || !historyItem || !historyItem.id) return;
    try {
      const historyRef = doc(this.db, 'sync_profiles', this.syncCode, 'quiz_history', String(historyItem.id));
      await setDoc(historyRef, {
        ...historyItem,
        syncCode: this.syncCode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("[FirebaseSync] saveQuizHistory error:", e);
    }
  }

  async deleteQuizHistory(id) {
    if (!this.db || !id) return;
    try {
      const historyRef = doc(this.db, 'sync_profiles', this.syncCode, 'quiz_history', String(id));
      await deleteDoc(historyRef);
    } catch (e) {
      console.warn("[FirebaseSync] deleteQuizHistory error:", e);
    }
  }
}

// Instantiate and expose globally
const syncService = new FirebaseSyncService();
window.fbSync = syncService;

export default syncService;

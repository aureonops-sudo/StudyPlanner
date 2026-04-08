/* ============================================
   API LAYER - Firebase Realtime Database
   ============================================ */

/* ---------- FIREBASE CONFIG ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyCwJN1GV5vMP-8FbtO4SFErpnbTpIgFNE",
  authDomain: "studytracker-5bf4f.firebaseapp.com",
  databaseURL: "https://studytracker-5bf4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "studytracker-5bf4f",
  storageBucket: "studytracker-5bf4f.firebasestorage.app",
  messagingSenderId: "716672075359",
  appId: "1:716672075359:web:4f0a5ebbc68f627803fdea"
};

const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ---------- REAL-TIME LISTENERS REGISTRY ---------- */
const activeListeners = {};

/* ---------- LOCAL STORAGE MANAGER ---------- */
const LocalDB = {
  get(sheetName) {
    const data = localStorage.getItem(`sheets_${sheetName}`);
    return data ? JSON.parse(data) : [];
  },

  append(sheetName, rowData) {
    const data = this.get(sheetName);
    data.push(rowData);
    localStorage.setItem(`sheets_${sheetName}`, JSON.stringify(data));
    return true;
  },

  update(sheetName, id, updates) {
    const data = this.get(sheetName);
    const index = data.findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
      data[index] = { ...data[index], ...updates };
      localStorage.setItem(`sheets_${sheetName}`, JSON.stringify(data));
    }
    return true;
  },

  delete(sheetName, id) {
    let data = this.get(sheetName);
    data = data.filter(item => String(item.id) !== String(id));
    localStorage.setItem(`sheets_${sheetName}`, JSON.stringify(data));
    return true;
  },

  set(sheetName, data) {
    localStorage.setItem(`sheets_${sheetName}`, JSON.stringify(data));
  }
};

/* ---------- FIREBASE HELPERS ---------- */
const FirebaseDB = {
  ref(sheetName) {
    return db.ref(sheetName);
  },

  async get(sheetName) {
    try {
      const snapshot = await this.ref(sheetName).once('value');
      const val = snapshot.val();
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      return Object.keys(val).map(key => ({ _firebaseKey: key, ...val[key] }));
    } catch (error) {
      console.error(`Firebase GET error for ${sheetName}:`, error);
      return LocalDB.get(sheetName);
    }
  },

  async append(sheetName, rowData) {
    try {
      const newRef = this.ref(sheetName).push();
      await newRef.set(rowData);
      return true;
    } catch (error) {
      console.error(`Firebase APPEND error for ${sheetName}:`, error);
      LocalDB.append(sheetName, rowData);
      return false;
    }
  },

  async update(sheetName, id, updates) {
    try {
      let snapshot = await this.ref(sheetName).orderByChild('id').equalTo(Number(id)).once('value');
      let val = snapshot.val();
      if (!val) {
        snapshot = await this.ref(sheetName).orderByChild('id').equalTo(String(id)).once('value');
        val = snapshot.val();
      }
      if (!val) { console.warn(`Record with id ${id} not found in ${sheetName}`); return false; }
      const firebaseKey = Object.keys(val)[0];
      await this.ref(sheetName).child(firebaseKey).update(updates);
      return true;
    } catch (error) {
      console.error(`Firebase UPDATE error for ${sheetName}:`, error);
      LocalDB.update(sheetName, id, updates);
      return false;
    }
  },

  async delete(sheetName, id) {
    try {
      let snapshot = await this.ref(sheetName).orderByChild('id').equalTo(Number(id)).once('value');
      let val = snapshot.val();
      if (!val) {
        snapshot = await this.ref(sheetName).orderByChild('id').equalTo(String(id)).once('value');
        val = snapshot.val();
      }
      if (!val) { console.warn(`Record with id ${id} not found in ${sheetName}`); return false; }
      const firebaseKey = Object.keys(val)[0];
      await this.ref(sheetName).child(firebaseKey).remove();
      return true;
    } catch (error) {
      console.error(`Firebase DELETE error for ${sheetName}:`, error);
      LocalDB.delete(sheetName, id);
      return false;
    }
  }
};

/* ---------- SHEET CATEGORIES ---------- */
const FIREBASE_SHEETS = ['Subjects', 'Chapters', 'Homework', 'Assignments', 'Tests', 'Todos', 'Goals'];
const LOCAL_ONLY_SHEETS = ['Parameters'];

/* ---------- UNIFIED API ---------- */
const API = {
  async getData(sheetName) {
    if (LOCAL_ONLY_SHEETS.includes(sheetName)) return LocalDB.get(sheetName);
    try {
      const data = await FirebaseDB.get(sheetName);
      if (data.length > 0) LocalDB.set(sheetName, data);
      return data.length > 0 ? data : LocalDB.get(sheetName);
    } catch (error) {
      console.error(`API getData failed for ${sheetName}:`, error);
      return LocalDB.get(sheetName);
    }
  },

  async postData(sheetName, rowData) {
    if (LOCAL_ONLY_SHEETS.includes(sheetName)) return LocalDB.append(sheetName, rowData);
    LocalDB.append(sheetName, rowData);
    return await FirebaseDB.append(sheetName, rowData);
  },

  async updateData(sheetName, id, updates) {
    if (LOCAL_ONLY_SHEETS.includes(sheetName)) return LocalDB.update(sheetName, id, updates);
    LocalDB.update(sheetName, id, updates);
    return await FirebaseDB.update(sheetName, id, updates);
  },

  async deleteData(sheetName, id) {
    if (LOCAL_ONLY_SHEETS.includes(sheetName)) return LocalDB.delete(sheetName, id);
    LocalDB.delete(sheetName, id);
    return await FirebaseDB.delete(sheetName, id);
  },

  onDataChange(sheetName, callback) {
    if (LOCAL_ONLY_SHEETS.includes(sheetName)) return;
    if (activeListeners[sheetName]) {
      FirebaseDB.ref(sheetName).off('value', activeListeners[sheetName]);
    }
    const listener = FirebaseDB.ref(sheetName).on('value', (snapshot) => {
      const val = snapshot.val();
      let data = [];
      if (val) {
        if (Array.isArray(val)) {
          data = val.filter(Boolean);
        } else {
          data = Object.keys(val).map(key => ({ _firebaseKey: key, ...val[key] }));
        }
      }
      LocalDB.set(sheetName, data);
      if (typeof callback === 'function') callback(data);
    });
    activeListeners[sheetName] = listener;
  },

  async syncAll() {
    const promises = FIREBASE_SHEETS.map(async (sheet) => {
      try {
        const data = await FirebaseDB.get(sheet);
        if (data && data.length > 0) LocalDB.set(sheet, data);
      } catch (e) {
        console.warn(`Sync failed for ${sheet}`, e);
      }
    });
    await Promise.allSettled(promises);
  }
};

/* ---------- TAB FOCUS SYNC ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (typeof refreshCurrentView === 'function') refreshCurrentView();
  }
});

/* ---------- SEED DATA ---------- */
async function initializeSeedData() {
  try {
    const existingSubjects = await FirebaseDB.get('Subjects');

    if (existingSubjects.length > 0) {
      console.log('[Init] Firebase already has data, skipping seed.');
      await API.syncAll();
      await seedParametersLocally();
      await runMigrations();
      return;
    }

    console.log('[Init] Seeding Firebase with initial data...');

    const subjects = [
      { id: 1, name: "Physics",   icon: "⚡", color: "#3D7A55" },
      { id: 2, name: "Chemistry", icon: "🧪", color: "#5B9E6E" },
      { id: 3, name: "Maths",     icon: "📐", color: "#C87941" },
      { id: 5, name: "English",   icon: "📖", color: "#7DAF8A" }
    ];

    const chapters = [
      // Physics (14 chapters)
      { id: 1,  subject_id: 1, name: "Electric Charges and Fields", progress: 0 },
      { id: 2,  subject_id: 1, name: "Electrostatic Potential and Capacitance", progress: 0 },
      { id: 3,  subject_id: 1, name: "Current Electricity", progress: 0 },
      { id: 4,  subject_id: 1, name: "Moving Charges and Magnetism", progress: 0 },
      { id: 5,  subject_id: 1, name: "Magnetism and Matter", progress: 0 },
      { id: 6,  subject_id: 1, name: "Electromagnetic Induction", progress: 0 },
      { id: 7,  subject_id: 1, name: "Alternating Current", progress: 0 },
      { id: 8,  subject_id: 1, name: "Electromagnetic Waves", progress: 0 },
      { id: 9,  subject_id: 1, name: "Ray Optics", progress: 0 },
      { id: 10, subject_id: 1, name: "Wave Optics", progress: 0 },
      { id: 11, subject_id: 1, name: "Dual Nature of Radiation and Matter", progress: 0 },
      { id: 12, subject_id: 1, name: "Atoms", progress: 0 },
      { id: 13, subject_id: 1, name: "Nuclei", progress: 0 },
      { id: 14, subject_id: 1, name: "Semiconductor Electronics", progress: 0 },

      // Chemistry (10 chapters)
      { id: 15, subject_id: 2, name: "Solutions", progress: 0 },
      { id: 16, subject_id: 2, name: "Electrochemistry", progress: 0 },
      { id: 17, subject_id: 2, name: "Chemical Kinetics", progress: 0 },
      { id: 18, subject_id: 2, name: "d and f Block Elements", progress: 0 },
      { id: 19, subject_id: 2, name: "Coordination Compounds", progress: 0 },
      { id: 20, subject_id: 2, name: "Haloalkanes and Haloarenes", progress: 0 },
      { id: 21, subject_id: 2, name: "Alcohols, Phenols and Ethers", progress: 0 },
      { id: 22, subject_id: 2, name: "Aldehydes, Ketones", progress: 0 },
      { id: 23, subject_id: 2, name: "Amines", progress: 0 },
      { id: 24, subject_id: 2, name: "Biomolecules", progress: 0 },

      // Maths (13 chapters)
      { id: 25, subject_id: 3, name: "Relations and Functions", progress: 0 },
      { id: 26, subject_id: 3, name: "Inverse Trigonometric Functions", progress: 0 },
      { id: 27, subject_id: 3, name: "Matrices", progress: 0 },
      { id: 28, subject_id: 3, name: "Determinants", progress: 0 },
      { id: 29, subject_id: 3, name: "Continuity and Differentiability", progress: 0 },
      { id: 30, subject_id: 3, name: "Applications of Derivatives", progress: 0 },
      { id: 31, subject_id: 3, name: "Integrals", progress: 0 },
      { id: 32, subject_id: 3, name: "Applications of Integrals", progress: 0 },
      { id: 33, subject_id: 3, name: "Differential Equations", progress: 0 },
      { id: 34, subject_id: 3, name: "Vector Algebra", progress: 0 },
      { id: 35, subject_id: 3, name: "Three Dimensional Geometry", progress: 0 },
      { id: 36, subject_id: 3, name: "Linear Programming", progress: 0 },
      { id: 37, subject_id: 3, name: "Probability", progress: 0 },

      // English — Flamingo Prose (8)
      { id: 44, subject_id: 5, name: "The Last Lesson", progress: 0 },
      { id: 45, subject_id: 5, name: "Lost Spring", progress: 0 },
      { id: 46, subject_id: 5, name: "Deep Water", progress: 0 },
      { id: 47, subject_id: 5, name: "The Rattrap", progress: 0 },
      { id: 48, subject_id: 5, name: "Indigo", progress: 0 },
      { id: 49, subject_id: 5, name: "Poets and Pancakes", progress: 0 },
      { id: 50, subject_id: 5, name: "The Interview", progress: 0 },
      { id: 51, subject_id: 5, name: "Going Places", progress: 0 },

      // English — Flamingo Poetry (5)
      { id: 52, subject_id: 5, name: "My Mother at Sixty-six", progress: 0 },
      { id: 53, subject_id: 5, name: "Keeping Quiet", progress: 0 },
      { id: 54, subject_id: 5, name: "A Thing of Beauty", progress: 0 },
      { id: 55, subject_id: 5, name: "A Roadside Stand", progress: 0 },
      { id: 56, subject_id: 5, name: "Aunt Jennifer's Tigers", progress: 0 },

      // English — Vistas (6)
      { id: 57, subject_id: 5, name: "The Third Level", progress: 0 },
      { id: 58, subject_id: 5, name: "The Tiger King", progress: 0 },
      { id: 59, subject_id: 5, name: "Journey to the End of the Earth", progress: 0 },
      { id: 60, subject_id: 5, name: "The Enemy", progress: 0 },
      { id: 61, subject_id: 5, name: "On the Face of It", progress: 0 },
      { id: 62, subject_id: 5, name: "Memories of Childhood", progress: 0 }
    ];

    const seedOps = [
      ...subjects.map(s => FirebaseDB.append('Subjects', s)),
      ...chapters.map(c => FirebaseDB.append('Chapters', c)),
    ];

    await Promise.allSettled(seedOps);
    console.log('[Init] Seed data written to Firebase');

    await API.syncAll();
    await seedParametersLocally();

  } catch (error) {
    console.error('[Init] Seed error:', error);
  }
}

/* ---------- PARAMETER SEED (NCERT-only for English) ---------- */
async function seedParametersLocally() {
  const existingParams = LocalDB.get('Parameters');
  if (existingParams.length > 0) return;

  let chapters = LocalDB.get('Chapters');
  if (chapters.length === 0) chapters = await FirebaseDB.get('Chapters');
  if (chapters.length === 0) return;

  // English chapter IDs (subject_id 5)
  const englishChapterIds = new Set([
    44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62
  ]);

  const standardParams = [
    "NCERT", "Help Book", "Module",
    "PYQ (Boards)", "PYQ (JEE Mains)", "PYQ (JEE Advanced)", "Short Notes"
  ];

  const params = [];
  let paramId = 1;

  // Filter out CS chapters (subject_id 4) in case they slipped through
  const validChapters = chapters.filter(c => c.subject_id !== 4);

  validChapters.forEach(chapter => {
    const types = englishChapterIds.has(chapter.id) ? ["NCERT"] : standardParams;
    types.forEach(type => {
      params.push({
        id: paramId++,
        chapter_id: chapter.id,
        type,
        status: "Pending",
        file_url: "",
        upload_date: ""
      });
    });
  });

  LocalDB.set('Parameters', params);
  console.log(`[Init] Seeded ${params.length} parameters locally`);
}

/* ---------- MIGRATIONS (run once on existing data) ---------- */
async function runMigrations() {
  const migrationKey = 'migration_v3_done';
  if (localStorage.getItem(migrationKey)) return;

  console.log('[Migration] Running data migrations...');

  try {
    // 1. Remove Computer Science subject (id:4) from Firebase
    await FirebaseDB.delete('Subjects', 4);

    // 2. Remove CS chapters (ids 38-43) from Firebase
    const csChapterIds = [38, 39, 40, 41, 42, 43];
    await Promise.allSettled(csChapterIds.map(id => FirebaseDB.delete('Chapters', id)));

    // 3. Remove CS from LocalDB
    LocalDB.set('Subjects', LocalDB.get('Subjects').filter(s => s.id !== 4));
    LocalDB.set('Chapters', LocalDB.get('Chapters').filter(c => c.subject_id !== 4));

    // 4. Clean English parameters — keep NCERT only
    const englishChapterIds = new Set([
      44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62
    ]);
    const allParams = LocalDB.get('Parameters');
    const cleanedParams = allParams.filter(p => {
      if (englishChapterIds.has(p.chapter_id)) {
        return p.type === 'NCERT';
      }
      // Also remove any CS chapter params (chapter_ids 38-43)
      if (csChapterIds.includes(p.chapter_id)) return false;
      return true;
    });
    LocalDB.set('Parameters', cleanedParams);
    console.log(`[Migration] Parameters cleaned: ${allParams.length} → ${cleanedParams.length}`);

    localStorage.setItem(migrationKey, 'true');
    console.log('[Migration] Done.');
  } catch (err) {
    console.error('[Migration] Error:', err);
  }
}

/* ---------- UTILITY FUNCTIONS ---------- */
function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * calculateChapterProgress — includes Parameters + Homework + Assignments
 * All three contribute equally per-item to the overall chapter progress.
 */
function calculateChapterProgress(chapterId) {
  const params = LocalDB.get('Parameters').filter(p => p.chapter_id === chapterId);

  // Get chapter name to look up homework & assignments
  const chapters = LocalDB.get('Chapters');
  const chapter = chapters.find(c => String(c.id) === String(chapterId));
  const chapterName = chapter ? chapter.name : null;

  const homework    = chapterName ? LocalDB.get('Homework').filter(h => h.chapter === chapterName) : [];
  const assignments = chapterName ? LocalDB.get('Assignments').filter(a => a.chapter === chapterName) : [];

  const totalItems = params.length + homework.length + assignments.length;
  if (totalItems === 0) return 0;

  const completedParams = params.filter(p => p.status === 'Completed').length;
  const doneHW          = homework.filter(h => h.status === 'Done').length;
  const doneAsgn        = assignments.filter(a => a.status === 'Done').length;

  return Math.round(((completedParams + doneHW + doneAsgn) / totalItems) * 100);
}

function calculateSubjectProgress(subjectId) {
  const chapters = LocalDB.get('Chapters').filter(c => c.subject_id === subjectId);
  if (chapters.length === 0) return 0;
  const total = chapters.reduce((sum, ch) => sum + calculateChapterProgress(ch.id), 0);
  return Math.round(total / chapters.length);
}

function updateChapterProgress(chapterId) {
  const progress = calculateChapterProgress(chapterId);
  LocalDB.update('Chapters', chapterId, { progress });
  return progress;
}

/* ---------- TOAST NOTIFICATIONS ---------- */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ---------- READY FLAG ---------- */
window._apiReady = initializeSeedData().then(() => {
  console.log('[Init] API ready');
  window.dispatchEvent(new Event('apiReady'));
}).catch(err => {
  console.error('[Init] API init failed:', err);
  window.dispatchEvent(new Event('apiReady'));
});

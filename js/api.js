/* ============================================
   API LAYER - Firebase Realtime Database
   ============================================ */

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
const activeListeners = {};

/* ---------- LOCAL DB ---------- */
const LocalDB = {
  get(n) { const d = localStorage.getItem(`sheets_${n}`); return d ? JSON.parse(d) : []; },
  append(n, row) { const d = this.get(n); d.push(row); localStorage.setItem(`sheets_${n}`, JSON.stringify(d)); return true; },
  update(n, id, u) {
    const d = this.get(n);
    const i = d.findIndex(x => String(x.id) === String(id));
    if (i !== -1) { d[i] = { ...d[i], ...u }; localStorage.setItem(`sheets_${n}`, JSON.stringify(d)); }
    return true;
  },
  delete(n, id) { const d = this.get(n).filter(x => String(x.id) !== String(id)); localStorage.setItem(`sheets_${n}`, JSON.stringify(d)); return true; },
  set(n, d) { localStorage.setItem(`sheets_${n}`, JSON.stringify(d)); }
};

/* ---------- FIREBASE DB ---------- */
const FirebaseDB = {
  ref(n) { return db.ref(n); },
  async get(n) {
    try {
      const snap = await this.ref(n).once('value');
      const val = snap.val();
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      return Object.keys(val).map(k => ({ _firebaseKey: k, ...val[k] }));
    } catch (e) { console.error(`FB GET ${n}:`, e); return LocalDB.get(n); }
  },
  async append(n, row) {
    try { await this.ref(n).push().set(row); return true; }
    catch (e) { console.error(`FB APPEND ${n}:`, e); LocalDB.append(n, row); return false; }
  },
  async update(n, id, u) {
    try {
      let snap = await this.ref(n).orderByChild('id').equalTo(Number(id)).once('value');
      let val = snap.val();
      if (!val) { snap = await this.ref(n).orderByChild('id').equalTo(String(id)).once('value'); val = snap.val(); }
      if (!val) return false;
      await this.ref(n).child(Object.keys(val)[0]).update(u);
      return true;
    } catch (e) { console.error(`FB UPDATE ${n}:`, e); LocalDB.update(n, id, u); return false; }
  },
  async delete(n, id) {
    try {
      let snap = await this.ref(n).orderByChild('id').equalTo(Number(id)).once('value');
      let val = snap.val();
      if (!val) { snap = await this.ref(n).orderByChild('id').equalTo(String(id)).once('value'); val = snap.val(); }
      if (!val) return false;
      await this.ref(n).child(Object.keys(val)[0]).remove();
      return true;
    } catch (e) { console.error(`FB DELETE ${n}:`, e); LocalDB.delete(n, id); return false; }
  }
};

/* ---------- SHEET CONFIG ---------- */
const FIREBASE_SHEETS = ['Subjects','Chapters','Homework','Assignments','Tests','Todos','Goals','Exams','Notes'];
const LOCAL_ONLY_SHEETS = ['Parameters','ChapterMeta'];

/* ---------- UNIFIED API ---------- */
const API = {
  async getData(n) {
    if (LOCAL_ONLY_SHEETS.includes(n)) return LocalDB.get(n);
    try {
      const d = await FirebaseDB.get(n);
      if (d.length > 0) LocalDB.set(n, d);
      return d.length > 0 ? d : LocalDB.get(n);
    } catch (e) { return LocalDB.get(n); }
  },
  async postData(n, row) {
    if (LOCAL_ONLY_SHEETS.includes(n)) return LocalDB.append(n, row);
    LocalDB.append(n, row);
    return await FirebaseDB.append(n, row);
  },
  async updateData(n, id, u) {
    if (LOCAL_ONLY_SHEETS.includes(n)) return LocalDB.update(n, id, u);
    LocalDB.update(n, id, u);
    return await FirebaseDB.update(n, id, u);
  },
  async deleteData(n, id) {
    if (LOCAL_ONLY_SHEETS.includes(n)) return LocalDB.delete(n, id);
    LocalDB.delete(n, id);
    return await FirebaseDB.delete(n, id);
  },
  onDataChange(n, cb) {
    if (LOCAL_ONLY_SHEETS.includes(n)) return;
    if (activeListeners[n]) FirebaseDB.ref(n).off('value', activeListeners[n]);
    activeListeners[n] = FirebaseDB.ref(n).on('value', snap => {
      const val = snap.val();
      const data = !val ? [] : Array.isArray(val) ? val.filter(Boolean) : Object.keys(val).map(k => ({ _firebaseKey: k, ...val[k] }));
      LocalDB.set(n, data);
      if (typeof cb === 'function') cb(data);
    });
  },
  async syncAll() {
    await Promise.allSettled(FIREBASE_SHEETS.map(async n => {
      try { const d = await FirebaseDB.get(n); if (d && d.length > 0) LocalDB.set(n, d); } catch (e) {}
    }));
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && typeof refreshCurrentView === 'function') refreshCurrentView();
});

/* ============================================
   CHAPTER META — Strength + Revision
   ============================================ */
function getChapterMeta(chapterId) {
  const meta = LocalDB.get('ChapterMeta');
  return meta.find(m => String(m.chapter_id) === String(chapterId))
    || {
        chapter_id:      String(chapterId),
        strength:        null,          // null = not set by user
        ncert_revised:   null,          // date string
        jee_revised:     null,          // date string
        chapter_end_date: null          // date when chapter was completed/finished
      };
}

function updateChapterMeta(chapterId, updates) {
  const meta = LocalDB.get('ChapterMeta');
  const idx  = meta.findIndex(m => String(m.chapter_id) === String(chapterId));
  if (idx !== -1) {
    meta[idx] = { ...meta[idx], ...updates };
  } else {
    meta.push({
      chapter_id:       String(chapterId),
      strength:         null,
      ncert_revised:    null,
      jee_revised:      null,
      chapter_end_date: null,
      ...updates
    });
  }
  LocalDB.set('ChapterMeta', meta);
}

/* ============================================
   ACTIVITY LOG — Heatmap
   ============================================ */
function logActivity(count = 1) {
  const today = getTodayStr();
  const log = JSON.parse(localStorage.getItem('studyActivityLog') || '{}');
  log[today] = (log[today] || 0) + count;
  localStorage.setItem('studyActivityLog', JSON.stringify(log));
}

function getActivityLog() {
  return JSON.parse(localStorage.getItem('studyActivityLog') || '{}');
}

/* ============================================
   DAILY STUDY PLAN
   ============================================ */
function getTodayPlan() {
  return JSON.parse(localStorage.getItem(`studyPlan_${getTodayStr()}`) || '[]');
}
function saveTodayPlan(plan) {
  localStorage.setItem(`studyPlan_${getTodayStr()}`, JSON.stringify(plan));
}
function addChapterToPlan(chapterId) {
  const plan = getTodayPlan();
  if (!plan.find(p => String(p.chapterId) === String(chapterId))) {
    plan.push({ chapterId: String(chapterId), done: false });
    saveTodayPlan(plan);
    return true;
  }
  return false;
}
function togglePlanItem(chapterId) {
  const plan = getTodayPlan();
  const item = plan.find(p => String(p.chapterId) === String(chapterId));
  if (item) {
    item.done = !item.done;
    if (item.done) { updateChapterMeta(chapterId, { last_revised: getTodayStr() }); logActivity(2); }
    saveTodayPlan(plan);
    return item.done;
  }
  return false;
}
function removePlanItem(chapterId) {
  saveTodayPlan(getTodayPlan().filter(p => String(p.chapterId) !== String(chapterId)));
}

/* ============================================
   HEALTH SCORE
   ============================================ */
function calculateSubjectHealthScore(subjectId) {
  const chapters = LocalDB.get('Chapters').filter(c => c.subject_id === subjectId);
  if (chapters.length === 0) return 0;
  const subject     = LocalDB.get('Subjects').find(s => s.id === subjectId);
  const subjectName = subject ? subject.name : '';

  const paramScore = calculateSubjectProgress(subjectId);

  const allHW = LocalDB.get('Homework').filter(h => h.subject === subjectName);
  const hwScore = allHW.length > 0
    ? Math.round(allHW.filter(h => h.status === 'Done').length / allHW.length * 100) : 100;

  const tests = LocalDB.get('Tests').filter(t => t.subject === subjectName);
  const testScore = tests.length > 0
    ? Math.round(tests.reduce((s, t) => s + (t.marks / t.total * 100), 0) / tests.length) : 50;

  const freshList = chapters.map(ch => {
    const m = getChapterMeta(ch.id);
    if (!m.last_revised) return 0;
    return Math.max(0, 100 - Math.floor((Date.now() - new Date(m.last_revised)) / 86400000) * 5);
  });
  const freshnessScore = Math.round(freshList.reduce((a, b) => a + b, 0) / freshList.length);

  return Math.min(100, Math.round(paramScore * 0.4 + hwScore * 0.2 + testScore * 0.25 + freshnessScore * 0.15));
}

/* ============================================
   PRIORITY QUEUE — reworked
   Factors: exam proximity, incomplete HW/asgn,
   chapter completion, revision staleness, strength
   ============================================ */
function generatePriorityQueue(limit = 8) {
  const chapters    = LocalDB.get('Chapters');
  const exams       = LocalDB.get('Exams') || [];
  const allHW       = LocalDB.get('Homework');
  const allAsgn     = LocalDB.get('Assignments');
  const now         = Date.now();

  const scored = chapters.map(ch => {
    const progress = calculateChapterProgress(ch.id);
    const meta     = getChapterMeta(ch.id);
    const subject  = LocalDB.get('Subjects').find(s => s.id === ch.subject_id);

    // ── 1. Exam proximity score (0–40 pts)
    let examScore = 0;
    const nearestDays = exams
      .filter(e => Number(e.subject_id) === Number(ch.subject_id))
      .map(e => (new Date(e.date) - now) / 86400000)
      .filter(d => d >= 0)
      .sort((a, b) => a - b)[0];
    if (nearestDays !== undefined) {
      if (nearestDays <= 7)  examScore = 40;
      else if (nearestDays <= 14) examScore = 28;
      else if (nearestDays <= 30) examScore = 16;
      else if (nearestDays <= 60) examScore = 8;
    }

    // ── 2. Pending homework/assignments for this chapter (0–25 pts)
    const pendingHW   = allHW.filter(h => h.chapter === ch.name && h.status === 'Pending').length;
    const pendingAsgn = allAsgn.filter(a => a.chapter === ch.name && a.status === 'Pending').length;
    const pendingScore = Math.min(25, (pendingHW * 8) + (pendingAsgn * 10));

    // ── 3. Completion gap (0–20 pts) — lower completion = higher score
    const completionScore = Math.round((1 - progress / 100) * 20);

    // ── 4. Revision staleness — NCERT (0–10 pts) + JEE (0–10 pts)
    const ncertDays = meta.ncert_revised
      ? (now - new Date(meta.ncert_revised)) / 86400000 : 999;
    const jeeDays   = meta.jee_revised
      ? (now - new Date(meta.jee_revised)) / 86400000   : 999;

    // Only penalise staleness if chapter has been started (progress > 0 or end date set)
    const isStarted = progress > 0 || meta.chapter_end_date;
    const ncertStaleScore = isStarted ? Math.min(10, Math.round(ncertDays / 7)) : 0;
    const jeeStaleScore   = isStarted ? Math.min(10, Math.round(jeeDays  / 7)) : 0;

    // ── 5. Strength modifier (+5 if Weak, -5 if Strong, 0 otherwise)
    const strengthBonus = meta.strength === 'Weak' ? 5 : meta.strength === 'Strong' ? -5 : 0;

    const totalScore = examScore + pendingScore + completionScore + ncertStaleScore + jeeStaleScore + strengthBonus;

    // Reasons for display
    const reasons = [];
    if (examScore > 0)    reasons.push(`📅 Exam in ${Math.ceil(nearestDays)}d`);
    if (pendingHW > 0)    reasons.push(`📝 ${pendingHW} HW pending`);
    if (pendingAsgn > 0)  reasons.push(`📑 ${pendingAsgn} asgn pending`);
    if (ncertDays < 999 && ncertDays > 14) reasons.push(`🔵 NCERT stale (${Math.floor(ncertDays)}d)`);
    if (jeeDays   < 999 && jeeDays   > 14) reasons.push(`🟠 JEE stale (${Math.floor(jeeDays)}d)`);
    if (meta.strength === 'Weak') reasons.push('⚠ Weak chapter');

    return {
      ...ch, progress, strength: meta.strength,
      ncert_revised: meta.ncert_revised,
      jee_revised:   meta.jee_revised,
      subjectName:   subject ? subject.name  : '',
      subjectColor:  subject ? subject.color : '#3D7A55',
      totalScore, reasons
    };
  });

  return scored
    .filter(ch => ch.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
}

/* ============================================
   PROGRESS CALCULATIONS
   ============================================ */
function calculateChapterProgress(chapterId) {
  const params   = LocalDB.get('Parameters').filter(p => p.chapter_id === chapterId);
  const chapter  = LocalDB.get('Chapters').find(c => String(c.id) === String(chapterId));
  const name     = chapter ? chapter.name : null;
  const hw       = name ? LocalDB.get('Homework').filter(h => h.chapter === name) : [];
  const asgn     = name ? LocalDB.get('Assignments').filter(a => a.chapter === name) : [];
  const total    = params.length + hw.length + asgn.length;
  if (total === 0) return 0;
  const done = params.filter(p => p.status === 'Completed').length
             + hw.filter(h => h.status === 'Done').length
             + asgn.filter(a => a.status === 'Done').length;
  return Math.round((done / total) * 100);
}

function calculateSubjectProgress(subjectId) {
  const chapters = LocalDB.get('Chapters').filter(c => c.subject_id === subjectId);
  if (chapters.length === 0) return 0;
  return Math.round(chapters.reduce((s, ch) => s + calculateChapterProgress(ch.id), 0) / chapters.length);
}

function updateChapterProgress(chapterId) {
  const p = calculateChapterProgress(chapterId);
  LocalDB.update('Chapters', chapterId, { progress: p });
  return p;
}

/* ============================================
   RECURRING HOMEWORK PROCESSOR
   ============================================ */
async function processRecurringHomework() {
  const today = getTodayStr();
  const allHW = await API.getData('Homework');
  const due = allHW.filter(h => h.recurring && h.status === 'Done' && h.next_due && h.next_due <= today);
  for (const hw of due) {
    const nd = new Date(hw.next_due);
    nd.setDate(nd.getDate() + 7);
    const nextDueStr = nd.toISOString().split('T')[0];
    await API.postData('Homework', {
      id: generateId(), title: hw.title, subject: hw.subject, chapter: hw.chapter,
      date: hw.next_due, status: 'Pending', file_url: '', recurring: true, next_due: nextDueStr
    });
    await API.updateData('Homework', hw.id, { next_due: nextDueStr });
  }
}

/* ============================================
   SEED + MIGRATIONS
   ============================================ */
async function initializeSeedData() {
  try {
    const existing = await FirebaseDB.get('Subjects');
    if (existing.length > 0) {
      await API.syncAll();
      await seedParametersLocally();
      await runMigrations();
      await processRecurringHomework();
      return;
    }
    const subjects = [
      { id: 1, name: "Physics",   icon: "⚡", color: "#3D7A55" },
      { id: 2, name: "Chemistry", icon: "🧪", color: "#5B9E6E" },
      { id: 3, name: "Maths",     icon: "📐", color: "#C87941" },
      { id: 5, name: "English",   icon: "📖", color: "#7DAF8A" }
    ];
    const chapters = [
      {id:1,subject_id:1,name:"Electric Charges and Fields",progress:0},
      {id:2,subject_id:1,name:"Electrostatic Potential and Capacitance",progress:0},
      {id:3,subject_id:1,name:"Current Electricity",progress:0},
      {id:4,subject_id:1,name:"Moving Charges and Magnetism",progress:0},
      {id:5,subject_id:1,name:"Magnetism and Matter",progress:0},
      {id:6,subject_id:1,name:"Electromagnetic Induction",progress:0},
      {id:7,subject_id:1,name:"Alternating Current",progress:0},
      {id:8,subject_id:1,name:"Electromagnetic Waves",progress:0},
      {id:9,subject_id:1,name:"Ray Optics",progress:0},
      {id:10,subject_id:1,name:"Wave Optics",progress:0},
      {id:11,subject_id:1,name:"Dual Nature of Radiation and Matter",progress:0},
      {id:12,subject_id:1,name:"Atoms",progress:0},
      {id:13,subject_id:1,name:"Nuclei",progress:0},
      {id:14,subject_id:1,name:"Semiconductor Electronics",progress:0},
      {id:15,subject_id:2,name:"Solutions",progress:0},
      {id:16,subject_id:2,name:"Electrochemistry",progress:0},
      {id:17,subject_id:2,name:"Chemical Kinetics",progress:0},
      {id:18,subject_id:2,name:"d and f Block Elements",progress:0},
      {id:19,subject_id:2,name:"Coordination Compounds",progress:0},
      {id:20,subject_id:2,name:"Haloalkanes and Haloarenes",progress:0},
      {id:21,subject_id:2,name:"Alcohols, Phenols and Ethers",progress:0},
      {id:22,subject_id:2,name:"Aldehydes, Ketones",progress:0},
      {id:23,subject_id:2,name:"Amines",progress:0},
      {id:24,subject_id:2,name:"Biomolecules",progress:0},
      {id:25,subject_id:3,name:"Relations and Functions",progress:0},
      {id:26,subject_id:3,name:"Inverse Trigonometric Functions",progress:0},
      {id:27,subject_id:3,name:"Matrices",progress:0},
      {id:28,subject_id:3,name:"Determinants",progress:0},
      {id:29,subject_id:3,name:"Continuity and Differentiability",progress:0},
      {id:30,subject_id:3,name:"Applications of Derivatives",progress:0},
      {id:31,subject_id:3,name:"Integrals",progress:0},
      {id:32,subject_id:3,name:"Applications of Integrals",progress:0},
      {id:33,subject_id:3,name:"Differential Equations",progress:0},
      {id:34,subject_id:3,name:"Vector Algebra",progress:0},
      {id:35,subject_id:3,name:"Three Dimensional Geometry",progress:0},
      {id:36,subject_id:3,name:"Linear Programming",progress:0},
      {id:37,subject_id:3,name:"Probability",progress:0},
      {id:44,subject_id:5,name:"The Last Lesson",progress:0},
      {id:45,subject_id:5,name:"Lost Spring",progress:0},
      {id:46,subject_id:5,name:"Deep Water",progress:0},
      {id:47,subject_id:5,name:"The Rattrap",progress:0},
      {id:48,subject_id:5,name:"Indigo",progress:0},
      {id:49,subject_id:5,name:"Poets and Pancakes",progress:0},
      {id:50,subject_id:5,name:"The Interview",progress:0},
      {id:51,subject_id:5,name:"Going Places",progress:0},
      {id:52,subject_id:5,name:"My Mother at Sixty-six",progress:0},
      {id:53,subject_id:5,name:"Keeping Quiet",progress:0},
      {id:54,subject_id:5,name:"A Thing of Beauty",progress:0},
      {id:55,subject_id:5,name:"A Roadside Stand",progress:0},
      {id:56,subject_id:5,name:"Aunt Jennifer's Tigers",progress:0},
      {id:57,subject_id:5,name:"The Third Level",progress:0},
      {id:58,subject_id:5,name:"The Tiger King",progress:0},
      {id:59,subject_id:5,name:"Journey to the End of the Earth",progress:0},
      {id:60,subject_id:5,name:"The Enemy",progress:0},
      {id:61,subject_id:5,name:"On the Face of It",progress:0},
      {id:62,subject_id:5,name:"Memories of Childhood",progress:0}
    ];
    await Promise.allSettled([
      ...subjects.map(s => FirebaseDB.append('Subjects', s)),
      ...chapters.map(c => FirebaseDB.append('Chapters', c)),
    ]);
    await API.syncAll();
    await seedParametersLocally();
  } catch (e) { console.error('[Init] Seed error:', e); }
}

async function seedParametersLocally() {
  if (LocalDB.get('Parameters').length > 0) return;
  let chapters = LocalDB.get('Chapters');
  if (!chapters.length) chapters = await FirebaseDB.get('Chapters');
  if (!chapters.length) return;

  const englishIds = new Set([44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62]);
  const stdParams  = ["NCERT","Help Book","Module","PYQ (Boards)","PYQ (JEE Mains)","PYQ (JEE Advanced)","Short Notes"];
  let paramId = 1;
  const params = [];
  chapters.filter(c => c.subject_id !== 4).forEach(ch => {
    const types = englishIds.has(ch.id) ? ["NCERT"] : stdParams;
    types.forEach(type => params.push({ id: paramId++, chapter_id: ch.id, type, status: "Pending", file_url: "", upload_date: "" }));
  });
  LocalDB.set('Parameters', params);
}

async function runMigrations() {
  if (localStorage.getItem('migration_v4_done')) return;
  try {
    await FirebaseDB.delete('Subjects', 4);
    const csIds = [38,39,40,41,42,43];
    await Promise.allSettled(csIds.map(id => FirebaseDB.delete('Chapters', id)));
    LocalDB.set('Subjects', LocalDB.get('Subjects').filter(s => s.id !== 4));
    LocalDB.set('Chapters', LocalDB.get('Chapters').filter(c => c.subject_id !== 4));
    const englishIds = new Set([44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62]);
    LocalDB.set('Parameters', LocalDB.get('Parameters').filter(p => {
      if (englishIds.has(p.chapter_id)) return p.type === 'NCERT';
      if (csIds.includes(p.chapter_id)) return false;
      return true;
    }));
    localStorage.setItem('migration_v4_done', 'true');
  } catch (e) { console.error('[Migration]', e); }
}

/* ---------- UTILITIES ---------- */
function generateId() { return Date.now() + Math.floor(Math.random() * 1000); }
function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }
function getTodayStr() { return new Date().toISOString().split('T')[0]; }
function getDaysUntil(d) { if (!d) return null; return Math.ceil((new Date(d) - new Date(getTodayStr())) / 86400000); }

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastSlideOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}

window._apiReady = initializeSeedData().then(() => {
  window.dispatchEvent(new Event('apiReady'));
}).catch(err => {
  console.error('[Init] failed:', err);
  window.dispatchEvent(new Event('apiReady'));
});

/* ============================================
   CHAPTER PAGE — Revision, Strength, Notes
   ============================================ */

let currentSubjectId = null;
let currentChapterId = null;
let notesSaveTimer   = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  currentSubjectId = parseInt(params.get('subject')) || 1;
  if (window._apiReady) window._apiReady.then(() => loadChapterPage());
  else window.addEventListener('apiReady', () => loadChapterPage());
});

async function refreshCurrentView() {
  await loadChapterPage();
  if (currentChapterId) loadParametersTab(currentChapterId);
}

/* ============================================
   CHAPTER LIST PAGE
   ============================================ */
async function loadChapterPage() {
  const subjects    = await API.getData('Subjects');
  const subject     = subjects.find(s => s.id === currentSubjectId);
  const allChapters = await API.getData('Chapters');
  const chapters    = allChapters.filter(c => c.subject_id === currentSubjectId);

  const titleEl = document.getElementById('chapter-page-title');
  if (titleEl && subject) titleEl.innerHTML = `<span style="margin-right:8px;">${subject.icon}</span>${subject.name}`;

  const progressEl = document.getElementById('subject-progress-display');
  if (progressEl) {
    const prog = calculateSubjectProgress(currentSubjectId);
    const health = calculateSubjectHealthScore(currentSubjectId);
    progressEl.innerHTML = `
      <div style="display:flex;gap:16px;align-items:center;">
        <div>
          <div class="progress-bar-wrapper" style="height:6px;margin-bottom:6px;margin-top:0;width:180px;">
            <div class="progress-bar-fill blue" style="width:${prog}%"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:13px;color:var(--accent-blue);">${prog}% Complete</span>
        </div>
        <div style="text-align:center;">
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:${health >= 70 ? '#3D7A55' : health >= 40 ? '#C87941' : '#B84C4C'};">${health}</div>
          <div style="font-size:10px;color:var(--text-muted);">Health</div>
        </div>
      </div>
    `;
  }

  const container = document.getElementById('chapter-list');
  if (!container) return;
  container.innerHTML = '';

  const strengthBadge = { Weak: '⚠', Average: '◎', Strong: '✓' };
  const strengthColor = { Weak: '#B84C4C', Average: '#C87941', Strong: '#3D7A55' };

  chapters.forEach((chapter, index) => {
    const progress  = calculateChapterProgress(chapter.id);
    const meta      = getChapterMeta(chapter.id);
    const params    = LocalDB.get('Parameters').filter(p => p.chapter_id === chapter.id);
    const hw        = LocalDB.get('Homework').filter(h => h.chapter === chapter.name);
    const asgn      = LocalDB.get('Assignments').filter(a => a.chapter === chapter.name);
    const daysSince = meta.last_revised
      ? Math.floor((Date.now() - new Date(meta.last_revised)) / 86400000)
      : null;
    const revisionLabel = daysSince === null ? 'Never revised'
      : daysSince === 0 ? 'Revised today'
      : `Revised ${daysSince}d ago`;
    const revColor = daysSince === null ? '#B84C4C' : daysSince <= 3 ? '#3D7A55' : daysSince <= 7 ? '#C87941' : '#B84C4C';

    const item = document.createElement('div');
    item.className = 'chapter-item';
    item.onclick = () => openChapterDetail(chapter.id);
    item.innerHTML = `
      <div class="chapter-info">
        <div class="chapter-number">${index + 1}</div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="chapter-name">${chapter.name}</div>
            <span style="font-size:11px;color:${strengthColor[meta.strength]};font-weight:600;">${strengthBadge[meta.strength] || ''} ${meta.strength}</span>
          </div>
          <div style="font-size:11px;color:${revColor};margin-top:2px;">🕐 ${revisionLabel}</div>
        </div>
      </div>
      <div class="chapter-progress">
        <div class="progress-bar-wrapper" style="width:100px;height:5px;margin-top:0;">
          <div class="progress-bar-fill ${progress === 100 ? 'green' : 'blue'}" style="width:${progress}%"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:13px;min-width:38px;text-align:right;color:${progress===100?'var(--accent-green)':'var(--text-secondary)'};">${progress}%</span>
      </div>
    `;
    container.appendChild(item);
  });
}

/* ============================================
   CHAPTER DETAIL PANEL
   ============================================ */
function openChapterDetail(chapterId) {
  currentChapterId = chapterId;
  const chapter = LocalDB.get('Chapters').find(c => c.id === chapterId);
  if (!chapter) return;

  document.getElementById('chapter-detail').classList.add('active');
  document.getElementById('detail-chapter-name').textContent = chapter.name;

  const progress = calculateChapterProgress(chapterId);
  document.getElementById('detail-progress').textContent = `${progress}%`;

  loadStrengthRevisionBar(chapterId);
  switchTab('parameters');
}

function closeChapterDetail() {
  document.getElementById('chapter-detail').classList.remove('active');
  currentChapterId = null;
}

function loadStrengthRevisionBar(chapterId) {
  const meta      = getChapterMeta(chapterId);
  const container = document.getElementById('strength-revision-bar');
  if (!container) return;

  const daysSince = meta.last_revised
    ? Math.floor((Date.now() - new Date(meta.last_revised)) / 86400000)
    : null;
  const revLabel  = daysSince === null ? '— Never revised'
    : daysSince === 0 ? '✓ Revised today'
    : `🕐 ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`;
  const revColor  = daysSince === null ? '#B84C4C' : daysSince <= 3 ? '#3D7A55' : daysSince <= 7 ? '#C87941' : '#B84C4C';

  const strengths = ['Weak', 'Average', 'Strong'];
  const sColors   = { Weak: '#B84C4C', Average: '#C87941', Strong: '#3D7A55' };

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">MASTERY LEVEL</div>
        <div style="display:flex;gap:6px;">
          ${strengths.map(s => `
            <button onclick="setStrength('${chapterId}','${s}')"
              style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid ${sColors[s]};background:${meta.strength===s ? sColors[s] : 'transparent'};color:${meta.strength===s ? 'white' : sColors[s]};transition:all 0.2s;">
              ${s}
            </button>
          `).join('')}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">LAST REVISED</div>
        <div style="font-size:12px;font-weight:500;color:${revColor};">${revLabel}</div>
        <button onclick="markRevised('${chapterId}')" style="margin-top:6px;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid #3D7A55;background:transparent;color:#3D7A55;">
          ✓ Mark Revised
        </button>
      </div>
    </div>
  `;
}

function setStrength(chapterId, strength) {
  updateChapterMeta(chapterId, { strength });
  loadStrengthRevisionBar(chapterId);
  loadChapterPage();
  showToast(`Marked as ${strength}`, 'success');
}

function markRevised(chapterId) {
  updateChapterMeta(chapterId, { last_revised: getTodayStr() });
  logActivity(1);
  loadStrengthRevisionBar(chapterId);
  loadChapterPage();
  showToast('Revision logged! 🌱', 'success');
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));
  if (currentChapterId) {
    switch (tabName) {
      case 'parameters':  loadParametersTab(currentChapterId);     break;
      case 'homework':    loadChapterHomework(currentChapterId);    break;
      case 'assignments': loadChapterAssignments(currentChapterId); break;
      case 'notes':       loadNotesTab(currentChapterId);           break;
    }
  }
}

/* ============================================
   PARAMETERS TAB
   ============================================ */
function loadParametersTab(chapterId) {
  const params    = LocalDB.get('Parameters').filter(p => p.chapter_id === chapterId);
  const container = document.getElementById('parameters-list');
  if (!container) return;
  container.innerHTML = '';

  if (params.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No parameters</p></div>';
    return;
  }

  params.forEach(param => {
    const done = param.status === 'Completed';
    const item = document.createElement('div');
    item.className = `parameter-item ${done ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="param-left">
        <div class="param-check" onclick="toggleParameter(${param.id}, event)">${done ? '✓' : ''}</div>
        <div>
          <div class="param-name">${param.type}</div>
          ${param.upload_date ? `<div class="param-date">Uploaded: ${formatDate(param.upload_date)}</div>` : ''}
        </div>
      </div>
      <div class="param-right">
        ${done ? `<span class="badge badge-done">Done</span>`
               : `<div class="file-upload">
                    <input type="file" onchange="uploadParameter(${param.id}, this)" />
                    <div class="file-upload-label">📎 Upload</div>
                  </div>`}
      </div>
    `;
    container.appendChild(item);
  });

  document.getElementById('detail-progress').textContent = `${calculateChapterProgress(chapterId)}%`;
}

function toggleParameter(paramId, event) {
  event.stopPropagation();
  const params = LocalDB.get('Parameters');
  const param  = params.find(p => p.id === paramId);
  if (!param) return;
  const newStatus = param.status === 'Completed' ? 'Pending' : 'Completed';
  LocalDB.update('Parameters', paramId, { status: newStatus, upload_date: newStatus==='Completed'?getTodayStr():'', file_url: newStatus==='Completed'?'toggled':'' });
  if (newStatus === 'Completed') logActivity(1);
  updateChapterProgress(currentChapterId);
  loadParametersTab(currentChapterId);
  loadChapterPage();
  showToast(newStatus === 'Completed' ? 'Parameter completed! ✓' : 'Parameter unmarked', newStatus==='Completed'?'success':'info');
}

function uploadParameter(paramId, input) {
  const file = input.files[0];
  if (!file) return;
  LocalDB.update('Parameters', paramId, { status:'Completed', file_url:URL.createObjectURL(file), upload_date:getTodayStr() });
  logActivity(1);
  updateChapterProgress(currentChapterId);
  loadParametersTab(currentChapterId);
  loadChapterPage();
  showToast(`${file.name} uploaded!`, 'success');
}

/* ============================================
   HOMEWORK TAB
   ============================================ */
async function loadChapterHomework(chapterId) {
  const chapter   = (await API.getData('Chapters')).find(c => c.id === chapterId);
  if (!chapter) return;
  const hw        = (await API.getData('Homework')).filter(h => h.chapter === chapter.name);
  const container = document.getElementById('chapter-homework-list');
  if (!container) return;
  container.innerHTML = '';
  if (hw.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No homework for this chapter</p></div>'; return; }
  hw.forEach(h => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px;';
    div.innerHTML = `
      <div>
        <div style="font-size:14px;color:var(--text-primary);">${h.title}</div>
        <div style="font-size:12px;color:var(--text-muted);">${formatDate(h.date)}</div>
      </div>
      <span class="badge ${h.status==='Done'?'badge-done':'badge-pending'}">${h.status}</span>
    `;
    container.appendChild(div);
  });
}

/* ============================================
   ASSIGNMENTS TAB
   ============================================ */
async function loadChapterAssignments(chapterId) {
  const chapter   = (await API.getData('Chapters')).find(c => c.id === chapterId);
  if (!chapter) return;
  const asgn      = (await API.getData('Assignments')).filter(a => a.chapter === chapter.name);
  const container = document.getElementById('chapter-assignments-list');
  if (!container) return;
  container.innerHTML = '';
  if (asgn.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📑</div><p>No assignments for this chapter</p></div>'; return; }
  asgn.forEach(a => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px;';
    div.innerHTML = `
      <div>
        <div style="font-size:14px;color:var(--text-primary);">${a.title}</div>
        <div style="font-size:12px;color:var(--text-muted);">Due: ${formatDate(a.deadline)}</div>
      </div>
      <span class="badge ${a.status==='Done'?'badge-done':'badge-pending'}">${a.status}</span>
    `;
    container.appendChild(div);
  });
}

/* ============================================
   NOTES TAB
   ============================================ */
async function loadNotesTab(chapterId) {
  const container = document.getElementById('notes-tab-content');
  if (!container) return;

  const notes = await API.getData('Notes');
  const note  = notes.find(n => String(n.chapter_id) === String(chapterId));

  container.innerHTML = `
    <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted);">Notes auto-save as you type</span>
      <span id="notes-save-status" style="font-size:11px;color:var(--text-muted);"></span>
    </div>
    <textarea id="chapter-notes-input"
      placeholder="Write your notes, formulas, key points..."
      style="width:100%;min-height:320px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:14px;font-family:var(--font-body);font-size:14px;color:var(--text-primary);resize:vertical;line-height:1.7;"
      oninput="scheduleNotesSave(${chapterId})"
    >${note ? note.content : ''}</textarea>
    ${note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Last updated: ${formatDate(note.updated_at)}</div>` : ''}
  `;
}

function scheduleNotesSave(chapterId) {
  const statusEl = document.getElementById('notes-save-status');
  if (statusEl) statusEl.textContent = 'Unsaved...';
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(() => saveNotes(chapterId), 1000);
}

async function saveNotes(chapterId) {
  const input   = document.getElementById('chapter-notes-input');
  if (!input) return;
  const content = input.value;
  const notes   = await API.getData('Notes');
  const existing = notes.find(n => String(n.chapter_id) === String(chapterId));

  if (existing) {
    await API.updateData('Notes', existing.id, { content, updated_at: getTodayStr() });
  } else {
    await API.postData('Notes', { id: generateId(), chapter_id: chapterId, content, updated_at: getTodayStr() });
  }

  const statusEl = document.getElementById('notes-save-status');
  if (statusEl) statusEl.textContent = '✓ Saved';
  setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
}

/* ============================================
   CHAPTER PAGE — Revision (NCERT+JEE), Strength, Notes, Chapter End Date
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
    const prog   = calculateSubjectProgress(currentSubjectId);
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
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:${health>=70?'#3D7A55':health>=40?'#C87941':'#B84C4C'};">${health}</div>
          <div style="font-size:10px;color:var(--text-muted);">Health</div>
        </div>
      </div>
    `;
  }

  const container = document.getElementById('chapter-list');
  if (!container) return;
  container.innerHTML = '';

  const sColors = { Weak: '#B84C4C', Average: '#C87941', Strong: '#3D7A55' };
  const sBadge  = { Weak: '⚠ Weak', Strong: '✓ Strong' };

  chapters.forEach((chapter, index) => {
    const progress = calculateChapterProgress(chapter.id);
    const meta     = getChapterMeta(chapter.id);

    // Revision staleness display — only when chapter is started or ended
    const isStarted = progress > 0 || meta.chapter_end_date;
    let revLine = '';
    if (isStarted) {
      const ncertDays = meta.ncert_revised ? Math.floor((Date.now()-new Date(meta.ncert_revised))/86400000) : null;
      const jeeDays   = meta.jee_revised   ? Math.floor((Date.now()-new Date(meta.jee_revised))/86400000)   : null;
      const nc = ncertDays===null ? '<span style="color:#B84C4C;">NCERT: never</span>'
               : ncertDays===0   ? '<span style="color:#3D7A55;">NCERT: today</span>'
               : `<span style="color:${ncertDays<=7?'#3D7A55':ncertDays<=14?'#C87941':'#B84C4C'};">NCERT: ${ncertDays}d ago</span>`;
      const jee = jeeDays===null ? '<span style="color:#B84C4C;">JEE: never</span>'
               : jeeDays===0    ? '<span style="color:#3D7A55;">JEE: today</span>'
               : `<span style="color:${jeeDays<=7?'#3D7A55':jeeDays<=14?'#C87941':'#B84C4C'};">JEE: ${jeeDays}d ago</span>`;
      revLine = `<div style="font-size:11px;margin-top:3px;display:flex;gap:8px;">🕐 ${nc} &nbsp;${jee}</div>`;
    }

    // Strength badge (only if set by user)
    const strengthTag = meta.strength
      ? `<span style="font-size:10px;color:${sColors[meta.strength]||'#C87941'};font-weight:600;margin-left:6px;">${sBadge[meta.strength]||'◎ '+meta.strength}</span>`
      : '';

    // Pending work badge
    const pendingHW   = LocalDB.get('Homework').filter(h=>h.chapter===chapter.name&&h.status==='Pending').length;
    const pendingAsgn = LocalDB.get('Assignments').filter(a=>a.chapter===chapter.name&&a.status==='Pending').length;
    const pendingTag  = (pendingHW+pendingAsgn)>0
      ? `<span style="font-size:10px;background:rgba(200,121,65,0.12);color:#C87941;padding:1px 6px;border-radius:8px;margin-left:4px;">📌 ${pendingHW+pendingAsgn} pending</span>` : '';

    const item = document.createElement('div');
    item.className = 'chapter-item';
    item.onclick = () => openChapterDetail(chapter.id);
    item.innerHTML = `
      <div class="chapter-info">
        <div class="chapter-number">${index+1}</div>
        <div style="min-width:0;">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">
            <div class="chapter-name">${chapter.name}</div>${strengthTag}${pendingTag}
          </div>
          ${revLine}
        </div>
      </div>
      <div class="chapter-progress">
        <div class="progress-bar-wrapper" style="width:90px;height:5px;margin-top:0;">
          <div class="progress-bar-fill ${progress===100?'green':'blue'}" style="width:${progress}%"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:13px;min-width:36px;text-align:right;color:${progress===100?'var(--accent-green)':'var(--text-secondary)'};">${progress}%</span>
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
  document.getElementById('detail-progress').textContent = `${calculateChapterProgress(chapterId)}%`;
  loadStrengthRevisionBar(chapterId);
  switchTab('parameters');
}

function closeChapterDetail() {
  document.getElementById('chapter-detail').classList.remove('active');
  currentChapterId = null;
}

/* ============================================
   STRENGTH + DUAL REVISION BAR + CHAPTER END DATE
   ============================================ */
function loadStrengthRevisionBar(chapterId) {
  const meta      = getChapterMeta(chapterId);
  const container = document.getElementById('strength-revision-bar');
  if (!container) return;

  const sColors = { Weak: '#B84C4C', Average: '#C87941', Strong: '#3D7A55' };

  // Revision display helper
  function revLabel(date) {
    if (!date) return { label: 'Never', color: '#B84C4C' };
    const d = Math.floor((Date.now()-new Date(date))/86400000);
    if (d===0) return { label: 'Today ✓', color: '#3D7A55' };
    return { label: `${d}d ago`, color: d<=7?'#3D7A55':d<=14?'#C87941':'#B84C4C' };
  }

  const ncertRev = revLabel(meta.ncert_revised);
  const jeeRev   = revLabel(meta.jee_revised);

  // Chapter end date info
  let endDateInfo = '';
  if (meta.chapter_end_date) {
    const daysSinceEnd = Math.floor((Date.now()-new Date(meta.chapter_end_date))/86400000);
    endDateInfo = `Chapter ended ${daysSinceEnd}d ago (${formatDate(meta.chapter_end_date)})`;
  }

  container.innerHTML = `
    <!-- MASTERY LEVEL -->
    <div style="margin-bottom:12px;">
      <div style="font-size:10px;color:var(--text-muted);letter-spacing:0.5px;margin-bottom:6px;">MASTERY LEVEL</div>
      <div style="display:flex;gap:6px;">
        ${['Weak','Average','Strong'].map(s => `
          <button onclick="setStrength('${chapterId}','${s}')"
            style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;
                   border:1.5px solid ${sColors[s]};
                   background:${meta.strength===s?sColors[s]:'transparent'};
                   color:${meta.strength===s?'white':sColors[s]};
                   transition:all 0.2s;">
            ${s}
          </button>`).join('')}
        ${meta.strength ? `<button onclick="clearStrength('${chapterId}')" style="padding:5px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);">✕</button>` : ''}
      </div>
    </div>

    <!-- DUAL REVISION CARDS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <!-- NCERT -->
      <div style="background:rgba(61,122,85,0.06);border:1px solid rgba(61,122,85,0.15);border-radius:8px;padding:10px 12px;">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">📘 NCERT REVISION</div>
        <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:${ncertRev.color};">${ncertRev.label}</div>
        ${meta.ncert_revised ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${formatDate(meta.ncert_revised)}</div>` : ''}
        <button onclick="markRevised('${chapterId}','ncert')"
          style="margin-top:8px;width:100%;padding:4px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid #3D7A55;background:transparent;color:#3D7A55;">
          ✓ Mark Done
        </button>
      </div>

      <!-- JEE -->
      <div style="background:rgba(200,121,65,0.06);border:1px solid rgba(200,121,65,0.15);border-radius:8px;padding:10px 12px;">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">🔶 JEE REVISION</div>
        <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:${jeeRev.color};">${jeeRev.label}</div>
        ${meta.jee_revised ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${formatDate(meta.jee_revised)}</div>` : ''}
        <button onclick="markRevised('${chapterId}','jee')"
          style="margin-top:8px;width:100%;padding:4px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid #C87941;background:transparent;color:#C87941;">
          ✓ Mark Done
        </button>
      </div>
    </div>

    <!-- CHAPTER END DATE -->
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border-color);">
      <div style="flex:1;">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">📆 CHAPTER ENDED ON</div>
        <input type="date" id="chapter-end-date-input" value="${meta.chapter_end_date||''}"
          onchange="saveChapterEndDate('${chapterId}',this.value)"
          style="background:transparent;border:none;font-size:12px;color:var(--text-primary);font-family:var(--font-body);width:100%;cursor:pointer;"/>
      </div>
      ${endDateInfo ? `<div style="font-size:11px;color:var(--text-muted);text-align:right;">${endDateInfo}</div>` : ''}
    </div>
  `;
}

function setStrength(chapterId, strength) {
  updateChapterMeta(chapterId, { strength });
  loadStrengthRevisionBar(chapterId);
  loadChapterPage();
  showToast(`Marked as ${strength}`, 'success');
}

function clearStrength(chapterId) {
  updateChapterMeta(chapterId, { strength: null });
  loadStrengthRevisionBar(chapterId);
  loadChapterPage();
}

function markRevised(chapterId, type) {
  // type = 'ncert' or 'jee'
  const update = type === 'ncert'
    ? { ncert_revised: getTodayStr() }
    : { jee_revised:   getTodayStr() };
  updateChapterMeta(chapterId, update);
  logActivity(1);
  loadStrengthRevisionBar(chapterId);
  loadChapterPage();
  showToast(`${type === 'ncert' ? 'NCERT' : 'JEE'} revision logged! 🌱`, 'success');
}

function saveChapterEndDate(chapterId, date) {
  if (!date) return;
  updateChapterMeta(chapterId, { chapter_end_date: date });
  loadStrengthRevisionBar(chapterId);
  loadChapterPage();
  showToast('Chapter end date saved', 'success');
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
    item.className = `parameter-item ${done?'completed':''}`;
    item.innerHTML = `
      <div class="param-left">
        <div class="param-check" onclick="toggleParameter(${param.id}, event)">${done?'✓':''}</div>
        <div>
          <div class="param-name">${param.type}</div>
          ${param.upload_date?`<div class="param-date">Uploaded: ${formatDate(param.upload_date)}</div>`:''}
        </div>
      </div>
      <div class="param-right">
        ${done ? `<span class="badge badge-done">Done</span>`
               : `<div class="file-upload"><input type="file" onchange="uploadParameter(${param.id},this)"/><div class="file-upload-label">📎 Upload</div></div>`}
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
  const newStatus = param.status==='Completed'?'Pending':'Completed';
  LocalDB.update('Parameters', paramId, { status:newStatus, upload_date:newStatus==='Completed'?getTodayStr():'', file_url:newStatus==='Completed'?'toggled':'' });
  if (newStatus==='Completed') logActivity(1);
  updateChapterProgress(currentChapterId);
  loadParametersTab(currentChapterId);
  loadChapterPage();
  showToast(newStatus==='Completed'?'Parameter completed! ✓':'Parameter unmarked', newStatus==='Completed'?'success':'info');
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
  if (hw.length===0) { container.innerHTML='<div class="empty-state"><div class="empty-icon">📝</div><p>No homework for this chapter</p></div>'; return; }
  hw.forEach(h => {
    const div = document.createElement('div');
    div.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px;';
    div.innerHTML=`<div><div style="font-size:14px;color:var(--text-primary);">${h.title}</div><div style="font-size:12px;color:var(--text-muted);">${formatDate(h.date)}</div></div><span class="badge ${h.status==='Done'?'badge-done':'badge-pending'}">${h.status}</span>`;
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
  if (asgn.length===0) { container.innerHTML='<div class="empty-state"><div class="empty-icon">📑</div><p>No assignments for this chapter</p></div>'; return; }
  asgn.forEach(a => {
    const div = document.createElement('div');
    div.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px;';
    div.innerHTML=`<div><div style="font-size:14px;color:var(--text-primary);">${a.title}</div><div style="font-size:12px;color:var(--text-muted);">Due: ${formatDate(a.deadline)}</div></div><span class="badge ${a.status==='Done'?'badge-done':'badge-pending'}">${a.status}</span>`;
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
  const note  = notes.find(n => String(n.chapter_id)===String(chapterId));
  container.innerHTML = `
    <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted);">Auto-saves as you type</span>
      <span id="notes-save-status" style="font-size:11px;color:var(--text-muted);"></span>
    </div>
    <textarea id="chapter-notes-input"
      placeholder="Key formulas, mnemonics, important points..."
      style="width:100%;min-height:320px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:14px;font-family:var(--font-body);font-size:14px;color:var(--text-primary);resize:vertical;line-height:1.7;"
      oninput="scheduleNotesSave(${chapterId})"
    >${note?note.content:''}</textarea>
    ${note?`<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Last updated: ${formatDate(note.updated_at)}</div>`:''}
  `;
}

function scheduleNotesSave(chapterId) {
  const s = document.getElementById('notes-save-status');
  if (s) s.textContent='Unsaved...';
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(() => saveNotes(chapterId), 1000);
}

async function saveNotes(chapterId) {
  const input = document.getElementById('chapter-notes-input');
  if (!input) return;
  const notes   = await API.getData('Notes');
  const existing = notes.find(n => String(n.chapter_id)===String(chapterId));
  if (existing) await API.updateData('Notes', existing.id, { content:input.value, updated_at:getTodayStr() });
  else await API.postData('Notes', { id:generateId(), chapter_id:chapterId, content:input.value, updated_at:getTodayStr() });
  const s = document.getElementById('notes-save-status');
  if (s) { s.textContent='✓ Saved'; setTimeout(()=>{ if(s) s.textContent=''; },2000); }
}

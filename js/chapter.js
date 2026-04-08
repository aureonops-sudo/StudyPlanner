/* ============================================
   CHAPTER PAGE Logic
   ============================================ */

let currentSubjectId = null;
let currentChapterId = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  currentSubjectId = parseInt(params.get('subject')) || 1;

  if (window._apiReady) {
    window._apiReady.then(() => loadChapterPage());
  } else {
    window.addEventListener('apiReady', () => loadChapterPage());
  }
});

async function refreshCurrentView() {
  await loadChapterPage();
  if (currentChapterId) loadParametersTab(currentChapterId);
}

async function loadChapterPage() {
  const subjects   = await API.getData('Subjects');
  const subject    = subjects.find(s => s.id === currentSubjectId);
  const allChapters = await API.getData('Chapters');
  const chapters   = allChapters.filter(c => c.subject_id === currentSubjectId);

  const titleEl = document.getElementById('chapter-page-title');
  if (titleEl && subject) {
    titleEl.innerHTML = `<span style="margin-right:8px;">${subject.icon}</span>${subject.name}`;
  }

  const progressEl = document.getElementById('subject-progress-display');
  if (progressEl) {
    const progress = calculateSubjectProgress(currentSubjectId);
    progressEl.innerHTML = `
      <div class="progress-bar-wrapper" style="height:6px;margin-bottom:8px;margin-top:0;">
        <div class="progress-bar-fill blue" style="width:${progress}%"></div>
      </div>
      <span style="font-family:var(--font-mono);font-size:13px;color:var(--accent-blue);">${progress}% Complete</span>
    `;
  }

  const container = document.getElementById('chapter-list');
  if (!container) return;
  container.innerHTML = '';

  chapters.forEach((chapter, index) => {
    const progress = calculateChapterProgress(chapter.id);
    const params   = LocalDB.get('Parameters').filter(p => p.chapter_id === chapter.id);
    const hw       = LocalDB.get('Homework').filter(h => h.chapter === chapter.name);
    const asgn     = LocalDB.get('Assignments').filter(a => a.chapter === chapter.name);
    const totalItems = params.length + hw.length + asgn.length;

    const item = document.createElement('div');
    item.className = 'chapter-item';
    item.onclick = () => openChapterDetail(chapter.id);
    item.innerHTML = `
      <div class="chapter-info">
        <div class="chapter-number">${index + 1}</div>
        <div>
          <div class="chapter-name">${chapter.name}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            ${params.length} param${params.length !== 1 ? 's' : ''}
            ${hw.length ? ` · ${hw.length} hw` : ''}
            ${asgn.length ? ` · ${asgn.length} asgn` : ''}
          </div>
        </div>
      </div>
      <div class="chapter-progress">
        <div class="progress-bar-wrapper" style="width:120px;height:6px;margin-top:0;">
          <div class="progress-bar-fill ${progress === 100 ? 'green' : 'blue'}" style="width:${progress}%"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:13px;min-width:40px;text-align:right;color:${progress === 100 ? 'var(--accent-green)' : 'var(--text-secondary)'};">
          ${progress}%
        </span>
      </div>
    `;
    container.appendChild(item);
  });
}

function openChapterDetail(chapterId) {
  currentChapterId = chapterId;
  const chapters = LocalDB.get('Chapters');
  const chapter  = chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  const panel = document.getElementById('chapter-detail');
  if (panel) panel.classList.add('active');

  const nameEl = document.getElementById('detail-chapter-name');
  if (nameEl) nameEl.textContent = chapter.name;

  const progress = calculateChapterProgress(chapterId);
  const progEl   = document.getElementById('detail-progress');
  if (progEl) progEl.textContent = `${progress}%`;

  switchTab('parameters');
  loadParametersTab(chapterId);
}

function closeChapterDetail() {
  const panel = document.getElementById('chapter-detail');
  if (panel) panel.classList.remove('active');
  currentChapterId = null;
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
  if (currentChapterId) {
    switch (tabName) {
      case 'parameters':   loadParametersTab(currentChapterId);    break;
      case 'homework':     loadChapterHomework(currentChapterId);   break;
      case 'assignments':  loadChapterAssignments(currentChapterId); break;
    }
  }
}

function loadParametersTab(chapterId) {
  const params    = LocalDB.get('Parameters').filter(p => p.chapter_id === chapterId);
  const container = document.getElementById('parameters-list');
  if (!container) return;
  container.innerHTML = '';

  if (params.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No parameters for this chapter</p></div>';
    return;
  }

  params.forEach(param => {
    const isCompleted = param.status === 'Completed';
    const item = document.createElement('div');
    item.className = `parameter-item ${isCompleted ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="param-left">
        <div class="param-check" onclick="toggleParameter(${param.id}, event)">
          ${isCompleted ? '✓' : ''}
        </div>
        <div>
          <div class="param-name">${param.type}</div>
          ${param.upload_date ? `<div class="param-date">Uploaded: ${formatDate(param.upload_date)}</div>` : ''}
        </div>
      </div>
      <div class="param-right">
        ${isCompleted
          ? `<span class="badge badge-done">Done</span>`
          : `<div class="file-upload">
               <input type="file" onchange="uploadParameter(${param.id}, this)" />
               <div class="file-upload-label">📎 Upload</div>
             </div>`
        }
      </div>
    `;
    container.appendChild(item);
  });

  const progress = calculateChapterProgress(chapterId);
  const progEl   = document.getElementById('detail-progress');
  if (progEl) progEl.textContent = `${progress}%`;
}

function toggleParameter(paramId, event) {
  event.stopPropagation();
  const params = LocalDB.get('Parameters');
  const param  = params.find(p => p.id === paramId);
  if (!param) return;

  const newStatus = param.status === 'Completed' ? 'Pending' : 'Completed';
  LocalDB.update('Parameters', paramId, {
    status: newStatus,
    upload_date: newStatus === 'Completed' ? getTodayStr() : '',
    file_url:    newStatus === 'Completed' ? 'toggled' : ''
  });

  updateChapterProgress(currentChapterId);
  loadParametersTab(currentChapterId);
  loadChapterPage();

  showToast(
    newStatus === 'Completed' ? 'Parameter completed! ✓' : 'Parameter unmarked',
    newStatus === 'Completed' ? 'success' : 'info'
  );
}

function uploadParameter(paramId, input) {
  const file = input.files[0];
  if (!file) return;

  LocalDB.update('Parameters', paramId, {
    status: 'Completed',
    file_url: URL.createObjectURL(file),
    upload_date: getTodayStr()
  });

  updateChapterProgress(currentChapterId);
  loadParametersTab(currentChapterId);
  loadChapterPage();
  showToast(`${file.name} uploaded successfully!`, 'success');
}

async function loadChapterHomework(chapterId) {
  const chapters = await API.getData('Chapters');
  const chapter  = chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  const allHomework = await API.getData('Homework');
  const homework    = allHomework.filter(h => h.chapter === chapter.name);
  const container   = document.getElementById('chapter-homework-list');
  if (!container) return;
  container.innerHTML = '';

  if (homework.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No homework for this chapter</p></div>';
    return;
  }

  homework.forEach(hw => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px;';
    item.innerHTML = `
      <div>
        <div style="font-size:14px;color:var(--text-primary);">${hw.title}</div>
        <div style="font-size:12px;color:var(--text-muted);">${formatDate(hw.date)}</div>
      </div>
      <span class="badge ${hw.status === 'Done' ? 'badge-done' : 'badge-pending'}">${hw.status}</span>
    `;
    container.appendChild(item);
  });
}

async function loadChapterAssignments(chapterId) {
  const chapters = await API.getData('Chapters');
  const chapter  = chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  const allAssignments = await API.getData('Assignments');
  const assignments    = allAssignments.filter(a => a.chapter === chapter.name);
  const container      = document.getElementById('chapter-assignments-list');
  if (!container) return;
  container.innerHTML = '';

  if (assignments.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📑</div><p>No assignments for this chapter</p></div>';
    return;
  }

  assignments.forEach(asgn => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px;';
    item.innerHTML = `
      <div>
        <div style="font-size:14px;color:var(--text-primary);">${asgn.title}</div>
        <div style="font-size:12px;color:var(--text-muted);">Due: ${formatDate(asgn.deadline)}</div>
      </div>
      <span class="badge ${asgn.status === 'Done' ? 'badge-done' : 'badge-pending'}">${asgn.status}</span>
    `;
    container.appendChild(item);
  });
}

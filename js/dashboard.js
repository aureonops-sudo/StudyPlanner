/* ============================================
   DASHBOARD Logic — All Features
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (window._apiReady) window._apiReady.then(() => initDashboard());
  else window.addEventListener('apiReady', () => initDashboard());
});

async function initDashboard() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  await loadStatCards();
  await loadHeatmap();
  await loadExamCountdown();
  await loadDailyPlanner();
  await loadPriorityQueue();
  await loadTodoList();
  await loadGoals();
  await loadPendingHomework();
  await loadPendingAssignments();
  await loadCharts();
}

async function refreshCurrentView() { destroyAllCharts(); await initDashboard(); }

/* ---------- CHARTS ---------- */
const chartInstances = {};
function destroyAllCharts() {
  Object.keys(chartInstances).forEach(k => { if (chartInstances[k]) { chartInstances[k].destroy(); chartInstances[k] = null; } });
}

/* ---------- DATETIME ---------- */
function updateDateTime() {
  const el = document.getElementById('datetime-widget');
  if (!el) return;
  const now = new Date();
  el.innerHTML = `
    <span class="date">${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
    &nbsp;&nbsp;
    <span class="time">${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})}</span>
  `;
}

/* ---------- STAT CARDS ---------- */
async function loadStatCards() {
  const subjects    = await API.getData('Subjects');
  const chapters    = await API.getData('Chapters');
  const homework    = await API.getData('Homework');
  const assignments = await API.getData('Assignments');
  const tests       = await API.getData('Tests');

  let total = 0;
  subjects.forEach(s => { total += calculateSubjectProgress(s.id); });
  const avg = subjects.length ? Math.round(total / subjects.length) : 0;

  const el = id => document.getElementById(id);
  if (el('stat-progress'))    el('stat-progress').textContent    = `${avg}%`;
  if (el('stat-homework'))    el('stat-homework').textContent    = homework.filter(h => h.status === 'Pending').length;
  if (el('stat-assignments')) el('stat-assignments').textContent = assignments.filter(a => a.status === 'Pending').length;
  if (el('stat-accuracy'))    el('stat-accuracy').textContent    = tests.length
    ? `${Math.round(tests.reduce((s,t)=>s+(t.marks/t.total*100),0)/tests.length)}%` : '0%';
}

/* ============================================
   HEATMAP — GitHub style, 16 weeks
   ============================================ */
function loadHeatmap() {
  const container = document.getElementById('heatmap-container');
  if (!container) return;

  const log    = getActivityLog();
  const today  = new Date();
  today.setHours(0,0,0,0);
  const weeks  = 16;
  const days   = weeks * 7;

  // Start from the Sunday before `days` ago
  const start  = new Date(today);
  start.setDate(start.getDate() - days + 1);
  // Align to Sunday
  start.setDate(start.getDate() - start.getDay());

  const cells  = [];
  const cur    = new Date(start);
  while (cur <= today) {
    cells.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  // Build month labels
  const monthLabels = {};
  cells.forEach((d, i) => {
    if (d.getDate() <= 7) {
      const col = Math.floor(i / 7);
      if (!monthLabels[col]) monthLabels[col] = d.toLocaleDateString('en-IN',{month:'short'});
    }
  });

  const totalCols = Math.ceil(cells.length / 7);
  let monthRow = '<div class="heatmap-months">';
  for (let c = 0; c < totalCols; c++) {
    monthRow += `<div class="heatmap-month-label">${monthLabels[c] || ''}</div>`;
  }
  monthRow += '</div>';

  let grid = '<div class="heatmap-grid">';
  // Day labels col
  grid += '<div class="heatmap-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>';

  // Week columns
  for (let c = 0; c < totalCols; c++) {
    grid += '<div class="heatmap-col">';
    for (let r = 0; r < 7; r++) {
      const cellIdx = c * 7 + r;
      const d       = cells[cellIdx];
      if (!d || d > today) { grid += '<div class="heatmap-cell empty"></div>'; continue; }
      const key     = d.toISOString().split('T')[0];
      const count   = log[key] || 0;
      const level   = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;
      const title   = `${key}: ${count} action${count !== 1 ? 's' : ''}`;
      grid += `<div class="heatmap-cell level-${level}" title="${title}"></div>`;
    }
    grid += '</div>';
  }
  grid += '</div>';

  container.innerHTML = monthRow + grid;
}

/* ============================================
   EXAM COUNTDOWN
   ============================================ */
async function loadExamCountdown() {
  const exams    = await API.getData('Exams');
  const subjects = await API.getData('Subjects');
  const container = document.getElementById('exam-countdown-list');
  if (!container) return;

  const upcoming = exams
    .map(e => ({ ...e, days: getDaysUntil(e.date) }))
    .filter(e => e.days !== null && e.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  if (upcoming.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-icon">📅</div><p>No upcoming exams</p></div>';
    return;
  }

  container.innerHTML = '';
  upcoming.forEach(exam => {
    const subject = subjects.find(s => Number(s.id) === Number(exam.subject_id));
    const color   = subject ? subject.color : '#3D7A55';
    const icon    = subject ? subject.icon  : '📚';
    const urgencyColor = exam.days <= 3 ? '#B84C4C' : exam.days <= 7 ? '#C87941' : '#3D7A55';
    const progress = subject ? calculateSubjectProgress(subject.id) : 0;

    const item = document.createElement('div');
    item.style.cssText = 'padding:12px 0;border-bottom:1px solid rgba(61,122,85,0.08);';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">${icon}</span>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${exam.name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${subject ? subject.name : ''} · ${formatDate(exam.date)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${urgencyColor};">${exam.days}</div>
          <div style="font-size:10px;color:var(--text-muted);">days left</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="progress-bar-wrapper" style="flex:1;height:4px;margin-top:0;">
          <div class="progress-bar-fill" style="width:${progress}%;background:${color};height:4px;"></div>
        </div>
        <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">${progress}%</span>
      </div>
    `;
    container.appendChild(item);
  });
}

/* Exam management modal */
async function showManageExamsModal() {
  const exams    = await API.getData('Exams');
  const subjects = await API.getData('Subjects');
  const modal    = document.getElementById('exam-modal');
  if (!modal) return;

  const list = document.getElementById('exam-modal-list');
  list.innerHTML = '';
  exams.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(exam => {
    const sub  = subjects.find(s => Number(s.id) === Number(exam.subject_id));
    const days = getDaysUntil(exam.date);
    const div  = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(61,122,85,0.08);';
    div.innerHTML = `
      <div>
        <div style="font-size:14px;font-weight:500;">${exam.name}</div>
        <div style="font-size:12px;color:var(--text-muted);">${sub ? sub.name : ''} · ${formatDate(exam.date)} · ${days >= 0 ? days + 'd left' : 'past'}</div>
      </div>
      <button class="btn-icon" onclick="deleteExam('${exam.id}')">🗑</button>
    `;
    list.appendChild(div);
  });

  // Populate subject dropdown
  const sel = document.getElementById('exam-subject');
  sel.innerHTML = '<option value="">Select Subject</option>';
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.icon} ${s.name}`;
    sel.appendChild(opt);
  });

  modal.classList.add('active');
}

function closeExamModal() { document.getElementById('exam-modal').classList.remove('active'); }

async function saveExam() {
  const name       = document.getElementById('exam-name').value.trim();
  const subject_id = document.getElementById('exam-subject').value;
  const date       = document.getElementById('exam-date').value;
  if (!name || !subject_id || !date) { showToast('Fill all fields', 'warning'); return; }

  await API.postData('Exams', { id: generateId(), name, subject_id: Number(subject_id), date });
  document.getElementById('exam-name').value = '';
  document.getElementById('exam-date').value = '';
  await showManageExamsModal();
  await loadExamCountdown();
  showToast('Exam added!', 'success');
}

async function deleteExam(id) {
  await API.deleteData('Exams', id);
  await showManageExamsModal();
  await loadExamCountdown();
  showToast('Exam removed', 'info');
}

/* ============================================
   DAILY STUDY PLANNER
   ============================================ */
async function loadDailyPlanner() {
  const container = document.getElementById('daily-planner-list');
  if (!container) return;

  const plan     = getTodayPlan();
  const chapters = LocalDB.get('Chapters');

  container.innerHTML = '';

  if (plan.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">No chapters planned for today. Add some below!</div>';
  } else {
    plan.forEach(item => {
      const ch  = chapters.find(c => String(c.id) === String(item.chapterId));
      if (!ch) return;
      const sub = LocalDB.get('Subjects').find(s => s.id === ch.subject_id);
      const color = sub ? sub.color : '#3D7A55';
      const div = document.createElement('div');
      div.className = 'planner-item';
      div.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:6px;background:${item.done ? 'rgba(61,122,85,0.06)' : 'var(--bg-primary)'};border:1px solid ${item.done ? 'rgba(61,122,85,0.2)' : 'var(--border-color)'};`;
      div.innerHTML = `
        <div onclick="handlePlanToggle('${ch.id}')" style="width:20px;height:20px;border-radius:50%;border:2px solid ${item.done ? '#3D7A55' : 'var(--text-muted)'};background:${item.done ? '#3D7A55' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:white;font-size:11px;">
          ${item.done ? '✓' : ''}
        </div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:500;color:var(--text-primary);${item.done ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${ch.name}</div>
          <div style="font-size:11px;color:${color};">${sub ? sub.name : ''}</div>
        </div>
        <div onclick="handlePlanRemove('${ch.id}')" style="cursor:pointer;color:var(--text-muted);font-size:14px;opacity:0.5;" title="Remove">✕</div>
      `;
      container.appendChild(div);
    });
  }

  // Populate chapter picker
  const picker = document.getElementById('planner-chapter-select');
  if (picker) {
    const subjects = LocalDB.get('Subjects');
    picker.innerHTML = '<option value="">Pick a chapter to add...</option>';
    subjects.forEach(sub => {
      const subChapters = chapters.filter(c => c.subject_id === sub.id);
      if (subChapters.length === 0) return;
      const group = document.createElement('optgroup');
      group.label = `${sub.icon} ${sub.name}`;
      subChapters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = ch.name;
        group.appendChild(opt);
      });
      picker.appendChild(group);
    });
  }

  // Today's progress
  const done  = plan.filter(p => p.done).length;
  const total = plan.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const prog  = document.getElementById('planner-progress');
  if (prog) prog.textContent = `${done}/${total} done`;
}

function handlePlanToggle(chapterId) {
  togglePlanItem(chapterId);
  loadDailyPlanner();
  showToast('Chapter marked as revised! 🌱', 'success');
}

function handlePlanRemove(chapterId) {
  removePlanItem(chapterId);
  loadDailyPlanner();
}

function handleAddToPlan() {
  const sel = document.getElementById('planner-chapter-select');
  if (!sel || !sel.value) return;
  const added = addChapterToPlan(sel.value);
  if (added) { loadDailyPlanner(); showToast('Chapter added to today\'s plan!', 'success'); }
  else showToast('Already in today\'s plan', 'info');
  sel.value = '';
}

/* ============================================
   PRIORITY QUEUE
   ============================================ */
async function loadPriorityQueue() {
  const container = document.getElementById('priority-queue-list');
  if (!container) return;

  await API.getData('Chapters'); // ensure synced
  const queue = generatePriorityQueue(8);

  container.innerHTML = '';
  if (queue.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-icon">🎉</div><p>Everything looks good!</p></div>';
    return;
  }

  const strengthStyles = {
    Weak:    { bg: 'rgba(184,76,76,0.1)',    color: '#B84C4C', label: '⚠ Weak' },
    Average: { bg: 'rgba(200,121,65,0.1)',   color: '#C87941', label: '◎ Average' },
    Strong:  { bg: 'rgba(61,122,85,0.1)',    color: '#3D7A55', label: '✓ Strong' }
  };

  queue.forEach((ch, i) => {
    const ss  = strengthStyles[ch.strength] || strengthStyles['Average'];
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(61,122,85,0.07);';
    div.innerHTML = `
      <div style="width:22px;height:22px;border-radius:50%;background:${ch.subjectColor}20;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:10px;font-weight:700;color:${ch.subjectColor};flex-shrink:0;">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ch.name}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:3px;">
          <span style="font-size:10px;color:${ch.subjectColor};">${ch.subjectName}</span>
          <span style="font-size:10px;background:${ss.bg};color:${ss.color};padding:1px 6px;border-radius:10px;">${ss.label}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:${ch.progress > 60 ? '#3D7A55' : ch.progress > 30 ? '#C87941' : '#B84C4C'};">${ch.progress}%</div>
        <div class="progress-bar-wrapper" style="width:48px;height:3px;margin-top:4px;">
          <div class="progress-bar-fill" style="width:${ch.progress}%;background:${ch.subjectColor};height:3px;"></div>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ============================================
   TODO
   ============================================ */
async function loadTodoList() {
  const todos = await API.getData('Todos');
  const container = document.getElementById('todo-list');
  if (!container) return;
  container.innerHTML = '';
  todos.forEach(todo => {
    const done = todo.done === true || todo.done === "true" || todo.done === "TRUE";
    const item = document.createElement('div');
    item.className = 'todo-item';
    item.innerHTML = `
      <div class="todo-checkbox ${done ? 'checked' : ''}" onclick="toggleTodo('${todo.id}')">${done ? '✓' : ''}</div>
      <span class="todo-text ${done ? 'done' : ''}">${todo.text}</span>
      <div class="todo-delete" onclick="deleteTodo('${todo.id}')">✕</div>
    `;
    container.appendChild(item);
  });
}
async function addTodo() {
  const input = document.getElementById('todo-input');
  const text  = input.value.trim();
  if (!text) return;
  await API.postData('Todos', { id: generateId(), text, done: false });
  input.value = '';
  await loadTodoList();
  showToast('Task added!', 'success');
}
async function toggleTodo(id) {
  const todos = await API.getData('Todos');
  const todo  = todos.find(t => String(t.id) === String(id));
  if (todo) {
    const cur = todo.done === true || todo.done === "true" || todo.done === "TRUE";
    await API.updateData('Todos', id, { done: !cur });
    await loadTodoList();
  }
}
async function deleteTodo(id) {
  await API.deleteData('Todos', id);
  await loadTodoList();
  showToast('Task removed', 'info');
}

/* ============================================
   GOALS
   ============================================ */
async function loadGoals() {
  const goals = await API.getData('Goals');
  const container = document.getElementById('goals-list');
  if (!container) return;
  container.innerHTML = '';
  goals.forEach(goal => {
    const div = document.createElement('div');
    div.style.marginBottom = '16px';
    div.innerHTML = `
      <div class="flex justify-between items-center mb-8">
        <span style="font-size:14px;">${goal.text}</span>
        <span class="text-blue" style="font-family:var(--font-mono);font-size:13px;">${goal.progress}%</span>
      </div>
      <div class="progress-bar-wrapper"><div class="progress-bar-fill blue" style="width:${goal.progress}%"></div></div>
    `;
    container.appendChild(div);
  });
}
async function addGoal() {
  const input = document.getElementById('goal-input');
  const text  = input.value.trim();
  if (!text) return;
  await API.postData('Goals', { id: generateId(), text, progress: 0 });
  input.value = '';
  await loadGoals();
  showToast('Goal added!', 'success');
}

/* ============================================
   PENDING HOMEWORK + ASSIGNMENTS (with color dots)
   ============================================ */
async function loadPendingHomework() {
  const subjects   = await API.getData('Subjects');
  const colorMap   = {};
  subjects.forEach(s => { colorMap[s.name] = s.color; });
  const hw = (await API.getData('Homework')).filter(h => h.status === 'Pending');
  const container  = document.getElementById('pending-homework');
  if (!container) return;
  container.innerHTML = '';
  if (hw.length === 0) { container.innerHTML = '<div class="empty-state"><p>No pending homework 🎉</p></div>'; return; }
  hw.slice(0,5).forEach(h => {
    const color = colorMap[h.subject] || '#3D7A55';
    const item  = document.createElement('div');
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(61,122,85,0.06);';
    item.innerHTML = `
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text-primary);">${h.title}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle;"></span>${h.subject} · ${h.chapter}
        </div>
      </div>
      <span class="badge badge-pending">Pending</span>
    `;
    container.appendChild(item);
  });
}

async function loadPendingAssignments() {
  const subjects  = await API.getData('Subjects');
  const colorMap  = {};
  subjects.forEach(s => { colorMap[s.name] = s.color; });
  const asgns     = (await API.getData('Assignments')).filter(a => a.status === 'Pending');
  const container = document.getElementById('pending-assignments');
  if (!container) return;
  container.innerHTML = '';
  if (asgns.length === 0) { container.innerHTML = '<div class="empty-state"><p>No pending assignments 🎉</p></div>'; return; }
  asgns.slice(0,5).forEach(a => {
    const color    = colorMap[a.subject] || '#3D7A55';
    const overdue  = a.deadline && new Date(a.deadline) < new Date();
    const item     = document.createElement('div');
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(61,122,85,0.06);';
    item.innerHTML = `
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text-primary);">${a.title}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle;"></span>${a.subject}${a.deadline ? ' · Due '+formatDate(a.deadline) : ''}
        </div>
      </div>
      <span class="badge ${overdue ? 'badge-urgent' : 'badge-pending'}">${overdue ? 'Overdue' : a.priority || 'Pending'}</span>
    `;
    container.appendChild(item);
  });
}

/* ============================================
   CHARTS
   ============================================ */
async function loadCharts() {
  await loadSubjectProgressChart();
  await loadCompletionPieChart();
}

async function loadSubjectProgressChart() {
  const ctx = document.getElementById('subject-progress-chart');
  if (!ctx) return;
  const subjects = await API.getData('Subjects');
  chartInstances['subjectProgress'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: subjects.map(s => s.name),
      datasets: [{
        label: 'Progress %',
        data: subjects.map(s => calculateSubjectProgress(s.id)),
        backgroundColor: subjects.map(s => s.color + '25'),
        borderColor: subjects.map(s => s.color),
        borderWidth: 2, borderRadius: 8, barThickness: 40
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { color: '#4A6B4E' }, grid: { color: 'rgba(61,122,85,0.08)' } },
        x: { ticks: { color: '#4A6B4E' }, grid: { display: false } }
      }
    }
  });
}

async function loadCompletionPieChart() {
  const ctx = document.getElementById('completion-pie-chart');
  if (!ctx) return;
  const params      = LocalDB.get('Parameters');
  const hw          = LocalDB.get('Homework');
  const asgn        = LocalDB.get('Assignments');
  const completed   = params.filter(p=>p.status==='Completed').length + hw.filter(h=>h.status==='Done').length + asgn.filter(a=>a.status==='Done').length;
  const pending     = (params.length-params.filter(p=>p.status==='Completed').length) + (hw.length-hw.filter(h=>h.status==='Done').length) + (asgn.length-asgn.filter(a=>a.status==='Done').length);
  chartInstances['completionPie'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed','Pending'],
      datasets: [{ data: [completed, pending], backgroundColor: ['#3D7A55','rgba(61,122,85,0.1)'], borderWidth: 0, cutout: '75%' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color:'#4A6B4E', padding:16, usePointStyle:true, font:{family:'Inter',size:12} } } }
    }
  });
}

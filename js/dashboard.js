/* ============================================
   DASHBOARD - index.html Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (window._apiReady) {
    window._apiReady.then(() => initDashboard());
  } else {
    window.addEventListener('apiReady', () => initDashboard());
  }
});

async function initDashboard() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  await loadStatCards();
  await loadTodoList();
  await loadGoals();
  await loadPendingHomework();
  await loadPendingAssignments();
  await loadCharts();
}

/* ---------- TAB FOCUS REFRESH ---------- */
async function refreshCurrentView() {
  destroyAllCharts();
  await initDashboard();
}

/* ---------- CHART CLEANUP ---------- */
const chartInstances = {};

function destroyAllCharts() {
  Object.keys(chartInstances).forEach(key => {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      chartInstances[key] = null;
    }
  });
}

/* ---------- DATE & TIME ---------- */
function updateDateTime() {
  const el = document.getElementById('datetime-widget');
  if (!el) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  el.innerHTML = `<span class="date">${dateStr}</span>&nbsp;&nbsp;<span class="time">${timeStr}</span>`;
}

/* ---------- STAT CARDS ---------- */
async function loadStatCards() {
  const subjects  = await API.getData('Subjects');
  const chapters  = await API.getData('Chapters');
  const homework  = await API.getData('Homework');
  const tests     = await API.getData('Tests');
  const assignments = await API.getData('Assignments');

  let totalProgress = 0;
  subjects.forEach(s => { totalProgress += calculateSubjectProgress(s.id); });
  const avgProgress = subjects.length > 0 ? Math.round(totalProgress / subjects.length) : 0;

  const pendingHW   = homework.filter(h => h.status === 'Pending').length;
  const pendingAsgn = assignments.filter(a => a.status === 'Pending').length;
  const totalChapters = chapters.length;

  let avgScore = 0;
  if (tests.length > 0) {
    avgScore = Math.round(tests.reduce((s, t) => s + (t.marks / t.total * 100), 0) / tests.length);
  }

  const el = id => document.getElementById(id);
  if (el('stat-progress'))    el('stat-progress').textContent    = `${avgProgress}%`;
  if (el('stat-homework'))    el('stat-homework').textContent    = pendingHW;
  if (el('stat-assignments')) el('stat-assignments').textContent = pendingAsgn;
  if (el('stat-chapters'))    el('stat-chapters').textContent    = totalChapters;
  if (el('stat-accuracy'))    el('stat-accuracy').textContent    = `${avgScore}%`;
}

/* ---------- TODO LIST ---------- */
async function loadTodoList() {
  const todos = await API.getData('Todos');
  const container = document.getElementById('todo-list');
  if (!container) return;
  container.innerHTML = '';

  todos.forEach(todo => {
    const isDone = todo.done === true || todo.done === "true" || todo.done === "TRUE";
    const item = document.createElement('div');
    item.className = 'todo-item';
    item.innerHTML = `
      <div class="todo-checkbox ${isDone ? 'checked' : ''}" onclick="toggleTodo('${todo.id}')">
        ${isDone ? '✓' : ''}
      </div>
      <span class="todo-text ${isDone ? 'done' : ''}">${todo.text}</span>
      <div class="todo-delete" onclick="deleteTodo('${todo.id}')">✕</div>
    `;
    container.appendChild(item);
  });
}

async function addTodo() {
  const input = document.getElementById('todo-input');
  const text = input.value.trim();
  if (!text) return;
  await API.postData('Todos', { id: generateId(), text, done: false });
  input.value = '';
  await loadTodoList();
  showToast('Task added!', 'success');
}

async function toggleTodo(id) {
  const todos = await API.getData('Todos');
  const todo = todos.find(t => String(t.id) === String(id));
  if (todo) {
    const currentDone = todo.done === true || todo.done === "true" || todo.done === "TRUE";
    await API.updateData('Todos', id, { done: !currentDone });
    await loadTodoList();
  }
}

async function deleteTodo(id) {
  await API.deleteData('Todos', id);
  await loadTodoList();
  showToast('Task removed', 'info');
}

/* ---------- GOALS ---------- */
async function loadGoals() {
  const goals = await API.getData('Goals');
  const container = document.getElementById('goals-list');
  if (!container) return;
  container.innerHTML = '';

  goals.forEach(goal => {
    const item = document.createElement('div');
    item.style.marginBottom = '16px';
    item.innerHTML = `
      <div class="flex justify-between items-center mb-8">
        <span style="font-size:14px;">${goal.text}</span>
        <span class="text-blue" style="font-family:var(--font-mono);font-size:13px;">${goal.progress}%</span>
      </div>
      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill blue" style="width:${goal.progress}%"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

async function addGoal() {
  const input = document.getElementById('goal-input');
  const text = input.value.trim();
  if (!text) return;
  await API.postData('Goals', { id: generateId(), text, progress: 0 });
  input.value = '';
  await loadGoals();
  showToast('Goal added!', 'success');
}

/* ---------- PENDING HOMEWORK ---------- */
async function loadPendingHomework() {
  const subjects = await API.getData('Subjects');
  const subjectColors = {};
  subjects.forEach(s => { subjectColors[s.name] = s.color; });

  const allHomework = await API.getData('Homework');
  const homework = allHomework.filter(h => h.status === 'Pending');
  const container = document.getElementById('pending-homework');
  if (!container) return;
  container.innerHTML = '';

  if (homework.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No pending homework 🎉</p></div>';
    return;
  }

  homework.slice(0, 5).forEach(hw => {
    const color = subjectColors[hw.subject] || 'var(--accent-blue)';
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(61,122,85,0.06);';
    item.innerHTML = `
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text-primary);">${hw.title}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;"></span>
          ${hw.subject} · ${hw.chapter}
        </div>
      </div>
      <span class="badge badge-pending">Pending</span>
    `;
    container.appendChild(item);
  });
}

/* ---------- PENDING ASSIGNMENTS ---------- */
async function loadPendingAssignments() {
  const subjects = await API.getData('Subjects');
  const subjectColors = {};
  subjects.forEach(s => { subjectColors[s.name] = s.color; });

  const allAssignments = await API.getData('Assignments');
  const pending = allAssignments.filter(a => a.status === 'Pending');
  const container = document.getElementById('pending-assignments');
  if (!container) return;
  container.innerHTML = '';

  if (pending.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No pending assignments 🎉</p></div>';
    return;
  }

  pending.slice(0, 5).forEach(asgn => {
    const color = subjectColors[asgn.subject] || 'var(--accent-blue)';
    const isOverdue = asgn.deadline && new Date(asgn.deadline) < new Date();
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(61,122,85,0.06);';
    item.innerHTML = `
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text-primary);">${asgn.title}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;"></span>
          ${asgn.subject}${asgn.deadline ? ' · Due ' + formatDate(asgn.deadline) : ''}
        </div>
      </div>
      <span class="badge ${isOverdue ? 'badge-urgent' : 'badge-pending'}">${isOverdue ? 'Overdue' : asgn.priority || 'Pending'}</span>
    `;
    container.appendChild(item);
  });
}

/* ---------- CHARTS ---------- */
async function loadCharts() {
  await loadSubjectProgressChart();
  await loadCompletionPieChart();
}

async function loadSubjectProgressChart() {
  const ctx = document.getElementById('subject-progress-chart');
  if (!ctx) return;

  const subjects = await API.getData('Subjects');
  const labels = subjects.map(s => s.name);
  const data   = subjects.map(s => calculateSubjectProgress(s.id));
  const colors = subjects.map(s => s.color);

  chartInstances['subjectProgress'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Progress %',
        data,
        backgroundColor: colors.map(c => c + '25'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true, max: 100,
          ticks: { color: '#4A6B4E' },
          grid: { color: 'rgba(61,122,85,0.08)' }
        },
        x: {
          ticks: { color: '#4A6B4E' },
          grid: { display: false }
        }
      }
    }
  });
}

async function loadCompletionPieChart() {
  const ctx = document.getElementById('completion-pie-chart');
  if (!ctx) return;

  const params      = LocalDB.get('Parameters');
  const homework    = LocalDB.get('Homework');
  const assignments = LocalDB.get('Assignments');

  const completedParams = params.filter(p => p.status === 'Completed').length;
  const doneHW          = homework.filter(h => h.status === 'Done').length;
  const doneAsgn        = assignments.filter(a => a.status === 'Done').length;
  const completed = completedParams + doneHW + doneAsgn;
  const pending   = (params.length - completedParams) + (homework.length - doneHW) + (assignments.length - doneAsgn);

  chartInstances['completionPie'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Pending'],
      datasets: [{
        data: [completed, pending],
        backgroundColor: ['#3D7A55', 'rgba(61,122,85,0.1)'],
        borderWidth: 0,
        cutout: '75%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#4A6B4E', padding: 16,
            usePointStyle: true,
            font: { family: 'Inter', size: 12 }
          }
        }
      }
    }
  });
}

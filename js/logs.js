/* ============================================
   HOMEWORK, ASSIGNMENTS, TESTS Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  function init() {
    switch (page) {
      case 'homework':    initHomeworkPage();    break;
      case 'assignments': initAssignmentsPage(); break;
      case 'tests':       initTestsPage();       break;
    }
  }

  if (window._apiReady) {
    window._apiReady.then(() => init());
  } else {
    window.addEventListener('apiReady', () => init());
  }
});

/* ---------- TAB FOCUS REFRESH ---------- */
async function refreshCurrentView() {
  const page = document.body.dataset.page;
  switch (page) {
    case 'homework':    await loadHomeworkTable(); break;
    case 'assignments': await loadAssignmentsTable(); break;
    case 'tests':
      await loadTestsTable();
      const ctx = document.getElementById('test-trend-chart');
      if (ctx) {
        const parent = ctx.parentElement;
        ctx.remove();
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'test-trend-chart';
        parent.appendChild(newCanvas);
        await loadTestCharts();
      }
      break;
  }
}

/* ---------- SUBJECT COLOR HELPER ---------- */
function getSubjectColorMap() {
  const subjects = LocalDB.get('Subjects');
  const map = {};
  subjects.forEach(s => { map[s.name] = s.color; });
  return map;
}

function subjectBadgeHTML(subjectName, colorMap) {
  const color = colorMap[subjectName] || '#3D7A55';
  return `<span class="badge" style="background:${color}20;color:${color};">${subjectName}</span>`;
}

/* =============================================
   HOMEWORK PAGE
   ============================================= */

async function initHomeworkPage() {
  await loadHomeworkTable();
  await populateSubjectDropdowns();
}

async function loadHomeworkTable(filterSubject, filterStatus) {
  let homework = await API.getData('Homework');
  const colorMap = getSubjectColorMap();

  if (filterSubject) homework = homework.filter(h => h.subject === filterSubject);
  if (filterStatus)  homework = homework.filter(h => h.status === filterStatus);

  homework.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('homework-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (homework.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No homework found</td></tr>`;
    return;
  }

  homework.forEach(hw => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;color:var(--text-primary);">${hw.title}</td>
      <td>${subjectBadgeHTML(hw.subject, colorMap)}</td>
      <td style="color:var(--text-secondary);font-size:13px;">${hw.chapter}</td>
      <td style="font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">${formatDate(hw.date)}</td>
      <td>
        <span class="badge ${hw.status === 'Done' ? 'badge-done' : 'badge-pending'}"
              style="cursor:pointer;" onclick="toggleHomeworkStatus('${hw.id}')">
          ${hw.status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:8px;">
          ${hw.status !== 'Done' ? `
            <div class="file-upload">
              <input type="file" onchange="uploadHomework('${hw.id}', this)" />
              <div class="file-upload-label ${hw.file_url ? 'uploaded' : ''}">
                ${hw.file_url ? '✓ Uploaded' : '📎 Upload'}
              </div>
            </div>
          ` : `<span style="color:var(--accent-green);font-size:13px;">✓ Complete</span>`}
          <button class="btn-icon" onclick="deleteHomework('${hw.id}')" title="Delete">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleHomeworkStatus(id) {
  const homework = await API.getData('Homework');
  const hw = homework.find(h => String(h.id) === String(id));
  if (!hw) return;
  const newStatus = hw.status === 'Done' ? 'Pending' : 'Done';
  await API.updateData('Homework', id, { status: newStatus });
  await loadHomeworkTable();
  showToast(newStatus === 'Done' ? 'Homework completed!' : 'Homework reopened',
            newStatus === 'Done' ? 'success' : 'info');
}

async function uploadHomework(id, input) {
  const file = input.files[0];
  if (!file) return;
  await API.updateData('Homework', id, { status: 'Done', file_url: URL.createObjectURL(file) });
  await loadHomeworkTable();
  showToast('Homework uploaded & marked done!', 'success');
}

async function deleteHomework(id) {
  if (!confirm('Delete this homework entry?')) return;
  await API.deleteData('Homework', id);
  await loadHomeworkTable();
  showToast('Homework deleted', 'info');
}

function showAddHomeworkModal() {
  document.getElementById('homework-modal').classList.add('active');
}

function closeHomeworkModal() {
  document.getElementById('homework-modal').classList.remove('active');
}

async function saveHomework() {
  const title   = document.getElementById('hw-title').value.trim();
  const subject = document.getElementById('hw-subject').value;
  const chapter = document.getElementById('hw-chapter').value.trim();
  const date    = document.getElementById('hw-date').value;

  if (!title || !subject) {
    showToast('Please fill in required fields', 'warning');
    return;
  }

  await API.postData('Homework', {
    id: generateId(), title, subject,
    chapter: chapter || 'General',
    date: date || getTodayStr(),
    status: 'Pending',
    file_url: ''
  });

  closeHomeworkModal();
  await loadHomeworkTable();
  showToast('Homework added!', 'success');

  document.getElementById('hw-title').value   = '';
  document.getElementById('hw-chapter').value = '';
}

async function filterHomework() {
  const subject = document.getElementById('filter-hw-subject').value;
  const status  = document.getElementById('filter-hw-status').value;
  await loadHomeworkTable(subject, status);
}

/* =============================================
   ASSIGNMENTS PAGE
   ============================================= */

async function initAssignmentsPage() {
  await loadAssignmentsTable();
  await populateSubjectDropdowns();
}

async function loadAssignmentsTable(filterSubject, filterStatus) {
  let assignments = await API.getData('Assignments');
  const colorMap = getSubjectColorMap();

  if (filterSubject) assignments = assignments.filter(a => a.subject === filterSubject);
  if (filterStatus)  assignments = assignments.filter(a => a.status === filterStatus);

  assignments.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('assignments-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (assignments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No assignments found</td></tr>`;
    return;
  }

  const priorityColors = { High: 'badge-urgent', Medium: 'badge-pending', Low: 'badge-info' };

  assignments.forEach(asgn => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;color:var(--text-primary);">${asgn.title}</td>
      <td>${subjectBadgeHTML(asgn.subject, colorMap)}</td>
      <td style="font-size:13px;color:var(--text-secondary);">${asgn.chapter}</td>
      <td><span class="badge ${priorityColors[asgn.priority] || 'badge-info'}">${asgn.priority}</span></td>
      <td style="font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">${formatDate(asgn.deadline)}</td>
      <td>
        <span class="badge ${asgn.status === 'Done' ? 'badge-done' : 'badge-pending'}"
              style="cursor:pointer;" onclick="toggleAssignmentStatus('${asgn.id}')">
          ${asgn.status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:8px;">
          ${asgn.status !== 'Done' ? `
            <div class="file-upload">
              <input type="file" onchange="uploadAssignment('${asgn.id}', this)" />
              <div class="file-upload-label">📎 Upload</div>
            </div>
          ` : `<span style="color:var(--accent-green);font-size:13px;">✓</span>`}
          <button class="btn-icon" onclick="deleteAssignment('${asgn.id}')">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleAssignmentStatus(id) {
  const assignments = await API.getData('Assignments');
  const asgn = assignments.find(a => String(a.id) === String(id));
  if (!asgn) return;
  await API.updateData('Assignments', id, { status: asgn.status === 'Done' ? 'Pending' : 'Done' });
  await loadAssignmentsTable();
  showToast('Assignment status updated!', 'success');
}

async function uploadAssignment(id, input) {
  const file = input.files[0];
  if (!file) return;
  await API.updateData('Assignments', id, { status: 'Done', file_url: URL.createObjectURL(file) });
  await loadAssignmentsTable();
  showToast('Assignment uploaded & marked done!', 'success');
}

async function deleteAssignment(id) {
  if (!confirm('Delete this assignment?')) return;
  await API.deleteData('Assignments', id);
  await loadAssignmentsTable();
  showToast('Assignment deleted', 'info');
}

function showAddAssignmentModal() {
  document.getElementById('assignment-modal').classList.add('active');
}

function closeAssignmentModal() {
  document.getElementById('assignment-modal').classList.remove('active');
}

async function saveAssignment() {
  const title    = document.getElementById('asgn-title').value.trim();
  const subject  = document.getElementById('asgn-subject').value;
  const chapter  = document.getElementById('asgn-chapter').value.trim();
  const deadline = document.getElementById('asgn-deadline').value;
  const priority = document.getElementById('asgn-priority').value;

  if (!title || !subject) {
    showToast('Please fill in required fields', 'warning');
    return;
  }

  await API.postData('Assignments', {
    id: generateId(), title, subject,
    chapter: chapter || 'General',
    date: getTodayStr(),
    deadline: deadline || '',
    priority: priority || 'Medium',
    status: 'Pending',
    file_url: ''
  });

  closeAssignmentModal();
  await loadAssignmentsTable();
  showToast('Assignment added!', 'success');
}

async function filterAssignments() {
  const subject = document.getElementById('filter-asgn-subject').value;
  const status  = document.getElementById('filter-asgn-status').value;
  await loadAssignmentsTable(subject, status);
}

/* =============================================
   TESTS PAGE
   ============================================= */

async function initTestsPage() {
  await loadTestsTable();
  await loadTestCharts();
  await populateSubjectDropdowns();
}

async function loadTestsTable() {
  const colorMap = getSubjectColorMap();
  const tests = (await API.getData('Tests')).sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('tests-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No tests recorded</td></tr>`;
    return;
  }

  tests.forEach(test => {
    const accuracy  = Math.round((test.marks / test.total) * 100);
    const accColor  = accuracy >= 80 ? 'text-green' : accuracy >= 60 ? 'text-orange' : 'text-red';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;color:var(--text-primary);">${test.test_name}</td>
      <td>${subjectBadgeHTML(test.subject, colorMap)}</td>
      <td style="font-family:var(--font-mono);color:var(--text-secondary);">${test.marks} / ${test.total}</td>
      <td><span class="${accColor}" style="font-family:var(--font-mono);font-weight:600;">${accuracy}%</span></td>
      <td style="font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">${formatDate(test.date)}</td>
      <td>
        <div style="display:flex;gap:8px;">
          <div class="file-upload">
            <input type="file" onchange="uploadCorrection('${test.id}', this)" />
            <div class="file-upload-label ${test.correction_url ? 'uploaded' : ''}">
              ${test.correction_url ? '✓ Correction' : '📎 Upload'}
            </div>
          </div>
          <button class="btn-icon" onclick="deleteTest('${test.id}')">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateTestStats(tests);
}

function updateTestStats(tests) {
  if (tests.length === 0) return;
  const avgAcc    = Math.round(tests.reduce((s, t) => s + (t.marks / t.total * 100), 0) / tests.length);
  const best      = Math.max(...tests.map(t => Math.round(t.marks / t.total * 100)));
  const totalTests = tests.length;

  const statsEl = document.getElementById('test-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">📊</div>
        <div class="stat-info"><h3>${avgAcc}%</h3><p>Avg Accuracy</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">🏆</div>
        <div class="stat-info"><h3>${best}%</h3><p>Best Score</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">📝</div>
        <div class="stat-info"><h3>${totalTests}</h3><p>Total Tests</p></div>
      </div>
    `;
  }
}

async function loadTestCharts() {
  const tests = (await API.getData('Tests')).sort((a, b) => new Date(a.date) - new Date(b.date));
  const ctx = document.getElementById('test-trend-chart');
  if (!ctx || tests.length === 0) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: tests.map(t => formatDate(t.date)),
      datasets: [{
        label: 'Accuracy %',
        data: tests.map(t => Math.round(t.marks / t.total * 100)),
        borderColor: '#3D7A55',
        backgroundColor: 'rgba(61,122,85,0.08)',
        fill: true, tension: 0.4,
        pointBackgroundColor: '#3D7A55', pointRadius: 6, pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { color: '#4A6B4E' }, grid: { color: 'rgba(61,122,85,0.08)' } },
        x: { ticks: { color: '#4A6B4E', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

async function uploadCorrection(id, input) {
  const file = input.files[0];
  if (!file) return;
  await API.updateData('Tests', id, { correction_url: URL.createObjectURL(file) });
  await loadTestsTable();
  showToast('Correction uploaded!', 'success');
}

async function deleteTest(id) {
  if (!confirm('Delete this test entry?')) return;
  await API.deleteData('Tests', id);
  await loadTestsTable();
  const ctx = document.getElementById('test-trend-chart');
  if (ctx) {
    const parent = ctx.parentElement;
    ctx.remove();
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'test-trend-chart';
    parent.appendChild(newCanvas);
    await loadTestCharts();
  }
  showToast('Test deleted', 'info');
}

function showAddTestModal()  { document.getElementById('test-modal').classList.add('active'); }
function closeTestModal()    { document.getElementById('test-modal').classList.remove('active'); }

async function saveTest() {
  const testName = document.getElementById('test-name').value.trim();
  const subject  = document.getElementById('test-subject').value;
  const marks    = parseInt(document.getElementById('test-marks').value);
  const total    = parseInt(document.getElementById('test-total').value);
  const date     = document.getElementById('test-date').value;

  if (!testName || !subject || isNaN(marks) || isNaN(total)) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }

  await API.postData('Tests', {
    id: generateId(), test_name: testName, subject, marks, total,
    date: date || getTodayStr(), correction_url: ''
  });

  closeTestModal();
  await loadTestsTable();

  const ctx = document.getElementById('test-trend-chart');
  if (ctx) {
    const parent = ctx.parentElement;
    ctx.remove();
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'test-trend-chart';
    parent.appendChild(newCanvas);
    await loadTestCharts();
  }

  showToast('Test recorded!', 'success');
}

/* =============================================
   SHARED UTILITIES
   ============================================= */

async function populateSubjectDropdowns() {
  const subjects = await API.getData('Subjects');
  const selects  = document.querySelectorAll('.subject-select');

  selects.forEach(select => {
    const placeholder = select.querySelector('option');
    select.innerHTML = '';
    if (placeholder) select.appendChild(placeholder);
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  });
}

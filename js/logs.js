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
  if (window._apiReady) window._apiReady.then(() => init());
  else window.addEventListener('apiReady', () => init());
});

async function refreshCurrentView() {
  const page = document.body.dataset.page;
  switch (page) {
    case 'homework':    await loadHomeworkTable(); break;
    case 'assignments': await loadAssignmentsTable(); break;
    case 'tests':
      await loadTestsTable();
      await loadSubjectTestBreakdown();
      const ctx = document.getElementById('test-trend-chart');
      if (ctx) { const p = ctx.parentElement; ctx.remove(); const nc = document.createElement('canvas'); nc.id='test-trend-chart'; p.appendChild(nc); await loadTestCharts(); }
      break;
  }
}

function getSubjectColorMap() {
  const map = {};
  LocalDB.get('Subjects').forEach(s => { map[s.name] = s.color; });
  return map;
}

function subjectBadgeHTML(name, colorMap) {
  const c = colorMap[name] || '#3D7A55';
  return `<span class="badge" style="background:${c}18;color:${c};">${name}</span>`;
}

/* ============================================
   HOMEWORK PAGE
   ============================================ */
async function initHomeworkPage() {
  await loadHomeworkTable();
  await populateSubjectDropdowns();
}

async function loadHomeworkTable(filterSubject, filterStatus) {
  let hw = await API.getData('Homework');
  const colorMap = getSubjectColorMap();
  if (filterSubject) hw = hw.filter(h => h.subject === filterSubject);
  if (filterStatus)  hw = hw.filter(h => h.status === filterStatus);
  hw.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('homework-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (hw.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No homework found</td></tr>`;
    return;
  }

  hw.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;color:var(--text-primary);">${h.title}${h.recurring ? ' <span style="font-size:10px;background:rgba(61,122,85,0.1);color:#3D7A55;padding:1px 6px;border-radius:8px;">🔁 Weekly</span>' : ''}</td>
      <td>${subjectBadgeHTML(h.subject, colorMap)}</td>
      <td style="color:var(--text-secondary);font-size:13px;">${h.chapter}</td>
      <td style="font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">${formatDate(h.date)}</td>
      <td>
        <span class="badge ${h.status==='Done'?'badge-done':'badge-pending'}" style="cursor:pointer;" onclick="toggleHomeworkStatus('${h.id}')">
          ${h.status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:8px;">
          ${h.status !== 'Done' ? `<div class="file-upload"><input type="file" onchange="uploadHomework('${h.id}',this)"/><div class="file-upload-label ${h.file_url?'uploaded':''}"> ${h.file_url?'✓ Uploaded':'📎 Upload'}</div></div>` : `<span style="color:var(--accent-green);font-size:13px;">✓ Complete</span>`}
          <button class="btn-icon" onclick="deleteHomework('${h.id}')" title="Delete">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleHomeworkStatus(id) {
  const hw  = await API.getData('Homework');
  const item = hw.find(h => String(h.id) === String(id));
  if (!item) return;
  const newStatus = item.status === 'Done' ? 'Pending' : 'Done';
  await API.updateData('Homework', id, { status: newStatus });
  if (newStatus === 'Done') logActivity(1);
  await loadHomeworkTable();
  showToast(newStatus==='Done'?'Homework completed!':'Homework reopened', newStatus==='Done'?'success':'info');
}

async function uploadHomework(id, input) {
  const file = input.files[0];
  if (!file) return;
  await API.updateData('Homework', id, { status:'Done', file_url:URL.createObjectURL(file) });
  logActivity(1);
  await loadHomeworkTable();
  showToast('Homework uploaded & done!', 'success');
}

async function deleteHomework(id) {
  if (!confirm('Delete this homework entry?')) return;
  await API.deleteData('Homework', id);
  await loadHomeworkTable();
  showToast('Homework deleted', 'info');
}

function showAddHomeworkModal() { document.getElementById('homework-modal').classList.add('active'); }
function closeHomeworkModal()   { document.getElementById('homework-modal').classList.remove('active'); }

async function saveHomework() {
  const title     = document.getElementById('hw-title').value.trim();
  const subject   = document.getElementById('hw-subject').value;
  const chapter   = document.getElementById('hw-chapter').value.trim();
  const date      = document.getElementById('hw-date').value;
  const recurring = document.getElementById('hw-recurring')?.checked || false;

  if (!title || !subject) { showToast('Fill required fields', 'warning'); return; }

  const dateVal = date || getTodayStr();
  const nextDue = new Date(dateVal);
  nextDue.setDate(nextDue.getDate() + 7);

  await API.postData('Homework', {
    id: generateId(), title, subject,
    chapter: chapter || 'General',
    date: dateVal, status: 'Pending', file_url: '',
    recurring,
    next_due: recurring ? nextDue.toISOString().split('T')[0] : null
  });

  closeHomeworkModal();
  await loadHomeworkTable();
  showToast('Homework added!', 'success');
  ['hw-title','hw-chapter'].forEach(id => document.getElementById(id) && (document.getElementById(id).value = ''));
  if (document.getElementById('hw-recurring')) document.getElementById('hw-recurring').checked = false;
}

async function filterHomework() {
  await loadHomeworkTable(document.getElementById('filter-hw-subject').value, document.getElementById('filter-hw-status').value);
}

/* ============================================
   ASSIGNMENTS PAGE
   ============================================ */
async function initAssignmentsPage() {
  await loadAssignmentsTable();
  await populateSubjectDropdowns();
}

async function loadAssignmentsTable(filterSubject, filterStatus) {
  let asgns = await API.getData('Assignments');
  const colorMap = getSubjectColorMap();
  if (filterSubject) asgns = asgns.filter(a => a.subject === filterSubject);
  if (filterStatus)  asgns = asgns.filter(a => a.status === filterStatus);
  asgns.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('assignments-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (asgns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No assignments found</td></tr>`;
    return;
  }

  const pColors = { High:'badge-urgent', Medium:'badge-pending', Low:'badge-info' };
  asgns.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;color:var(--text-primary);">${a.title}</td>
      <td>${subjectBadgeHTML(a.subject, colorMap)}</td>
      <td style="font-size:13px;color:var(--text-secondary);">${a.chapter}</td>
      <td><span class="badge ${pColors[a.priority]||'badge-info'}">${a.priority}</span></td>
      <td style="font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">${formatDate(a.deadline)}</td>
      <td>
        <span class="badge ${a.status==='Done'?'badge-done':'badge-pending'}" style="cursor:pointer;" onclick="toggleAssignmentStatus('${a.id}')">
          ${a.status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:8px;">
          ${a.status!=='Done' ? `<div class="file-upload"><input type="file" onchange="uploadAssignment('${a.id}',this)"/><div class="file-upload-label">📎 Upload</div></div>` : `<span style="color:var(--accent-green);font-size:13px;">✓</span>`}
          <button class="btn-icon" onclick="deleteAssignment('${a.id}')">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleAssignmentStatus(id) {
  const asgns = await API.getData('Assignments');
  const a     = asgns.find(x => String(x.id) === String(id));
  if (!a) return;
  const newStatus = a.status === 'Done' ? 'Pending' : 'Done';
  await API.updateData('Assignments', id, { status: newStatus });
  if (newStatus === 'Done') logActivity(1);
  await loadAssignmentsTable();
  showToast('Assignment updated!', 'success');
}

async function uploadAssignment(id, input) {
  const file = input.files[0];
  if (!file) return;
  await API.updateData('Assignments', id, { status:'Done', file_url:URL.createObjectURL(file) });
  logActivity(1);
  await loadAssignmentsTable();
  showToast('Assignment uploaded & done!', 'success');
}

async function deleteAssignment(id) {
  if (!confirm('Delete this assignment?')) return;
  await API.deleteData('Assignments', id);
  await loadAssignmentsTable();
  showToast('Assignment deleted', 'info');
}

function showAddAssignmentModal() { document.getElementById('assignment-modal').classList.add('active'); }
function closeAssignmentModal()   { document.getElementById('assignment-modal').classList.remove('active'); }

async function saveAssignment() {
  const title    = document.getElementById('asgn-title').value.trim();
  const subject  = document.getElementById('asgn-subject').value;
  const chapter  = document.getElementById('asgn-chapter').value.trim();
  const deadline = document.getElementById('asgn-deadline').value;
  const priority = document.getElementById('asgn-priority').value;
  if (!title || !subject) { showToast('Fill required fields', 'warning'); return; }
  await API.postData('Assignments', {
    id: generateId(), title, subject,
    chapter: chapter || 'General',
    date: getTodayStr(), deadline: deadline || '',
    priority: priority || 'Medium', status: 'Pending', file_url: ''
  });
  closeAssignmentModal();
  await loadAssignmentsTable();
  showToast('Assignment added!', 'success');
}

async function filterAssignments() {
  await loadAssignmentsTable(document.getElementById('filter-asgn-subject').value, document.getElementById('filter-asgn-status').value);
}

/* ============================================
   TESTS PAGE
   ============================================ */
async function initTestsPage() {
  await loadTestsTable();
  await loadSubjectTestBreakdown();
  await loadTestCharts();
  await populateSubjectDropdowns();
}

async function loadTestsTable() {
  const colorMap = getSubjectColorMap();
  const tests    = (await API.getData('Tests')).sort((a,b) => new Date(b.date)-new Date(a.date));
  const tbody    = document.getElementById('tests-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No tests recorded</td></tr>`;
    return;
  }

  tests.forEach(test => {
    const acc = Math.round((test.marks/test.total)*100);
    const accColor = acc>=80?'text-green':acc>=60?'text-orange':'text-red';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;color:var(--text-primary);">${test.test_name}</td>
      <td>${subjectBadgeHTML(test.subject, colorMap)}</td>
      <td style="font-family:var(--font-mono);color:var(--text-secondary);">${test.marks} / ${test.total}</td>
      <td><span class="${accColor}" style="font-family:var(--font-mono);font-weight:600;">${acc}%</span></td>
      <td style="font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">${formatDate(test.date)}</td>
      <td>
        <div style="display:flex;gap:8px;">
          <div class="file-upload">
            <input type="file" onchange="uploadCorrection('${test.id}',this)"/>
            <div class="file-upload-label ${test.correction_url?'uploaded':''}">${test.correction_url?'✓ Correction':'📎 Upload'}</div>
          </div>
          <button class="btn-icon" onclick="deleteTest('${test.id}')">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateTestStats(tests);
}

/* Per-subject test breakdown */
async function loadSubjectTestBreakdown() {
  const container = document.getElementById('subject-test-breakdown');
  if (!container) return;
  const tests    = await API.getData('Tests');
  const subjects = await API.getData('Subjects');
  if (tests.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = '';
  subjects.forEach(sub => {
    const subTests = tests.filter(t => t.subject === sub.name);
    if (subTests.length === 0) return;
    const avg  = Math.round(subTests.reduce((s,t) => s+(t.marks/t.total*100),0)/subTests.length);
    const best = Math.max(...subTests.map(t => Math.round(t.marks/t.total*100)));
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.position = 'relative';
    card.innerHTML = `
      <div style="width:4px;height:100%;background:${sub.color};border-radius:4px;position:absolute;left:0;top:0;"></div>
      <div style="margin-left:8px;">
        <div style="font-size:18px;margin-bottom:4px;">${sub.icon}</div>
        <div style="font-family:var(--font-heading);font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:2px;">${sub.name}</div>
        <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${sub.color};">${avg}%</div>
        <div style="font-size:11px;color:var(--text-muted);">${subTests.length} tests · Best ${best}%</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateTestStats(tests) {
  if (!tests.length) return;
  const avg   = Math.round(tests.reduce((s,t)=>s+(t.marks/t.total*100),0)/tests.length);
  const best  = Math.max(...tests.map(t=>Math.round(t.marks/t.total*100)));
  const el    = document.getElementById('test-stats');
  if (el) el.innerHTML = `
    <div class="stat-card"><div class="stat-icon blue">📊</div><div class="stat-info"><h3>${avg}%</h3><p>Avg Accuracy</p></div></div>
    <div class="stat-card"><div class="stat-icon green">🏆</div><div class="stat-info"><h3>${best}%</h3><p>Best Score</p></div></div>
    <div class="stat-card"><div class="stat-icon orange">📝</div><div class="stat-info"><h3>${tests.length}</h3><p>Total Tests</p></div></div>
  `;
}

async function loadTestCharts() {
  const tests = (await API.getData('Tests')).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const ctx   = document.getElementById('test-trend-chart');
  if (!ctx || tests.length===0) return;
  new Chart(ctx, {
    type:'line',
    data:{
      labels: tests.map(t=>formatDate(t.date)),
      datasets:[{ label:'Accuracy %', data:tests.map(t=>Math.round(t.marks/t.total*100)),
        borderColor:'#3D7A55', backgroundColor:'rgba(61,122,85,0.08)', fill:true, tension:0.4,
        pointBackgroundColor:'#3D7A55', pointRadius:6, pointHoverRadius:8 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        y:{beginAtZero:true,max:100,ticks:{color:'#4A6B4E'},grid:{color:'rgba(61,122,85,0.08)'}},
        x:{ticks:{color:'#4A6B4E',font:{size:11}},grid:{display:false}}
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
  if (!confirm('Delete this test?')) return;
  await API.deleteData('Tests', id);
  await loadTestsTable();
  await loadSubjectTestBreakdown();
  const ctx = document.getElementById('test-trend-chart');
  if (ctx) { const p=ctx.parentElement; ctx.remove(); const nc=document.createElement('canvas'); nc.id='test-trend-chart'; p.appendChild(nc); await loadTestCharts(); }
  showToast('Test deleted', 'info');
}

function showAddTestModal()  { document.getElementById('test-modal').classList.add('active'); }
function closeTestModal()    { document.getElementById('test-modal').classList.remove('active'); }

async function saveTest() {
  const name   = document.getElementById('test-name').value.trim();
  const sub    = document.getElementById('test-subject').value;
  const marks  = parseInt(document.getElementById('test-marks').value);
  const total  = parseInt(document.getElementById('test-total').value);
  const date   = document.getElementById('test-date').value;
  if (!name||!sub||isNaN(marks)||isNaN(total)) { showToast('Fill all required fields','warning'); return; }
  await API.postData('Tests', { id:generateId(), test_name:name, subject:sub, marks, total, date:date||getTodayStr(), correction_url:'' });
  closeTestModal();
  await loadTestsTable();
  await loadSubjectTestBreakdown();
  const ctx = document.getElementById('test-trend-chart');
  if (ctx) { const p=ctx.parentElement; ctx.remove(); const nc=document.createElement('canvas'); nc.id='test-trend-chart'; p.appendChild(nc); await loadTestCharts(); }
  showToast('Test recorded!', 'success');
}

async function populateSubjectDropdowns() {
  const subjects = await API.getData('Subjects');
  document.querySelectorAll('.subject-select').forEach(sel => {
    const first = sel.querySelector('option');
    sel.innerHTML = '';
    if (first) sel.appendChild(first);
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name; opt.textContent = s.name;
      sel.appendChild(opt);
    });
  });
}

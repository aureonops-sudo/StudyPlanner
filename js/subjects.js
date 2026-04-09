/* ============================================
   SUBJECTS PAGE
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (window._apiReady) window._apiReady.then(() => loadSubjectsPage());
  else window.addEventListener('apiReady', () => loadSubjectsPage());
});

async function refreshCurrentView() { await loadSubjectsPage(); }

async function loadSubjectsPage() {
  const subjects = await API.getData('Subjects');
  const chapters = await API.getData('Chapters');
  const container = document.getElementById('subjects-grid');
  if (!container) return;
  container.innerHTML = '';

  subjects.forEach(subject => {
    const subChapters = chapters.filter(c => c.subject_id === subject.id);
    const progress    = calculateSubjectProgress(subject.id);
    const health      = calculateSubjectHealthScore(subject.id);
    const completed   = subChapters.filter(c => calculateChapterProgress(c.id) === 100).length;

    // Strength breakdown
    const meta      = subChapters.map(ch => getChapterMeta(ch.id));
    const weakCount = meta.filter(m => m.strength === 'Weak').length;
    const strongCount = meta.filter(m => m.strength === 'Strong').length;

    const healthColor = health >= 70 ? '#3D7A55' : health >= 40 ? '#C87941' : '#B84C4C';
    const healthLabel = health >= 70 ? 'Healthy' : health >= 40 ? 'Needs Work' : 'At Risk';

    // Revision staleness: how many chapters never revised / overdue
    const overdueCount = meta.filter(m => {
      if (!m.last_revised) return true;
      return (Date.now() - new Date(m.last_revised)) / 86400000 > 10;
    }).length;

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.onclick = () => window.location.href = `chapter.html?subject=${subject.id}`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div class="subject-icon" style="background:${subject.color}18;">
          <span>${subject.icon}</span>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:${healthColor};">${health}</div>
          <div style="font-size:10px;font-weight:600;color:${healthColor};padding:2px 7px;background:${healthColor}15;border-radius:10px;">${healthLabel}</div>
        </div>
      </div>

      <h3>${subject.name}</h3>
      <p class="chapter-count">${subChapters.length} Chapters · ${completed} Done</p>

      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill" style="width:${progress}%;background:${subject.color}"></div>
      </div>
      <div class="progress-text" style="color:${subject.color}">${progress}% Complete</div>

      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        ${weakCount > 0 ? `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(184,76,76,0.1);color:#B84C4C;">⚠ ${weakCount} Weak</span>` : ''}
        ${strongCount > 0 ? `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(61,122,85,0.1);color:#3D7A55;">✓ ${strongCount} Strong</span>` : ''}
        ${overdueCount > 0 ? `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(200,121,65,0.1);color:#C87941;">🕐 ${overdueCount} Stale</span>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

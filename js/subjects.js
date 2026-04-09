/* ============================================
   SUBJECTS PAGE Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (window._apiReady) {
    window._apiReady.then(() => loadSubjectsPage());
  } else {
    window.addEventListener('apiReady', () => loadSubjectsPage());
  }
});

async function refreshCurrentView() {
  await loadSubjectsPage();
}

async function loadSubjectsPage() {
  const subjects = await API.getData('Subjects');
  const chapters = await API.getData('Chapters');
  const container = document.getElementById('subjects-grid');
  if (!container) return;

  container.innerHTML = '';

  subjects.forEach(subject => {
    const subjectChapters = chapters.filter(c => c.subject_id === subject.id);
    const progress = calculateSubjectProgress(subject.id);
    const completedChapters = subjectChapters.filter(c => calculateChapterProgress(c.id) === 100).length;

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.onclick = () => navigateToChapters(subject.id);
    card.innerHTML = `
      <div class="subject-icon" style="background:${subject.color}20;">
        <span>${subject.icon}</span>
      </div>
      <h3>${subject.name}</h3>
      <p class="chapter-count">${subjectChapters.length} Chapters · ${completedChapters} Done</p>
      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill" style="width:${progress}%;background:${subject.color}"></div>
      </div>
      <div class="progress-text" style="color:${subject.color}">${progress}%</div>
    `;
    container.appendChild(card);
  });
}

function navigateToChapters(subjectId) {
  window.location.href = `chapter.html?subject=${subjectId}`;
}

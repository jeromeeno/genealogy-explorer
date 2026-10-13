// ================= STATE & CONFIG =================
const TARGET_PIN = '9169';
let currentPin = '';
let currentTab = 'search';
let currentFilter = 'all';
let currentSearchTerm = '';
let currentResults = [];
let displayLimit = 50;
let currentTreeRootId = 'PW92-F2S';

const data = window.GENEALOGY_DATA || { people: {}, warStories: [], immigrantStories: [], stats: {} };
const people = data.people || {};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  checkPinAuth();
  setupKeyboardListener();
  renderWarStories();
  renderImmigrationTimeline();
  executeSearch();
  renderTree();
});

// ================= PIN AUTH =================
function checkPinAuth() {
  const saved = localStorage.getItem('eno_genealogy_pin_unlocked');
  if (saved === TARGET_PIN) {
    unlockApp();
  }
}

function unlockApp() {
  const lockScreen = document.getElementById('lockScreen');
  lockScreen.classList.add('unlocked');
  localStorage.setItem('eno_genealogy_pin_unlocked', TARGET_PIN);
}

function lockApp() {
  localStorage.removeItem('eno_genealogy_pin_unlocked');
  currentPin = '';
  updatePinDots();
  const lockScreen = document.getElementById('lockScreen');
  lockScreen.classList.remove('unlocked');
}

function pressKey(num) {
  if (currentPin.length < 4) {
    currentPin += num;
    updatePinDots();
    if (currentPin.length === 4) {
      setTimeout(verifyPin, 100);
    }
  }
}

function clearPin() {
  currentPin = '';
  updatePinDots();
}

function deletePin() {
  if (currentPin.length > 0) {
    currentPin = currentPin.slice(0, -1);
    updatePinDots();
  }
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot${i}`);
    if (i < currentPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  }
}

function verifyPin() {
  if (currentPin === TARGET_PIN) {
    unlockApp();
  } else {
    const dots = document.getElementById('pinDots');
    dots.classList.add('shake');
    setTimeout(() => {
      dots.classList.remove('shake');
      clearPin();
    }, 450);
  }
}

function setupKeyboardListener() {
  window.addEventListener('keydown', (e) => {
    const lockScreen = document.getElementById('lockScreen');
    if (!lockScreen.classList.contains('unlocked')) {
      if (e.key >= '0' && e.key <= '9') {
        pressKey(e.key);
      } else if (e.key === 'Backspace') {
        deletePin();
      } else if (e.key === 'Escape') {
        clearPin();
      }
    }
  });
}

// ================= TABS =================
function switchTab(tabId, el) {
  currentTab = tabId;
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
  
  const targetSection = document.getElementById(`view-${tabId}`);
  if (targetSection) targetSection.classList.add('active');
  if (el) el.classList.add('active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= DIRECTORY / SEARCH =================
function setFilter(filterType, el) {
  currentFilter = filterType;
  document.querySelectorAll('.filter-chips-wrap .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  executeSearch();
}

function handleSearch() {
  const input = document.getElementById('searchInput');
  currentSearchTerm = input.value.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClearBtn');
  if (currentSearchTerm.length > 0) {
    clearBtn.classList.add('visible');
  } else {
    clearBtn.classList.remove('visible');
  }
  executeSearch();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  currentSearchTerm = '';
  document.getElementById('searchClearBtn').classList.remove('visible');
  executeSearch();
}

function executeSearch() {
  displayLimit = 50;
  const allPeople = Object.values(people);

  currentResults = allPeople.filter(p => {
    // 1. Filter Chip Matching
    if (currentFilter === 'jerome' && p.s !== 'jerome') return false;
    if (currentFilter === 'amy' && p.s !== 'amy') return false;
    if (currentFilter === 'war') {
      const hasWar = (p.tags || []).some(t => t.type === 'war');
      if (!hasWar) return false;
    }
    if (currentFilter === 'immigrant') {
      const hasImm = (p.tags || []).some(t => t.type === 'immigrant');
      if (!hasImm) return false;
    }
    if (currentFilter === 'fallriver') {
      const hasFR = (p.tags || []).some(t => t.label.includes('Fall River'));
      if (!hasFR) return false;
    }
    if (currentFilter === 'lowell') {
      const hasL = (p.tags || []).some(t => t.label.includes('Lowell'));
      if (!hasL) return false;
    }
    if (currentFilter === 'groton') {
      const hasG = (p.tags || []).some(t => t.label.includes('Groton'));
      if (!hasG) return false;
    }

    // 2. Text Search Matching
    if (currentSearchTerm) {
      const searchStr = `${p.n} ${p.id} ${p.bp} ${p.dp} ${p.bu}`.toLowerCase();
      if (!searchStr.includes(currentSearchTerm)) return false;
    }

    return true;
  });

  // Sort by generation ascending (closest relatives first), then name
  currentResults.sort((a, b) => {
    const genA = a.gen !== null ? a.gen : 999;
    const genB = b.gen !== null ? b.gen : 999;
    if (genA !== genB) return genA - genB;
    return a.n.localeCompare(b.n);
  });

  renderSearchResults();
}

function renderSearchResults() {
  const container = document.getElementById('personList');
  const countEl = document.getElementById('resultsCount');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  countEl.textContent = `Showing ${Math.min(displayLimit, currentResults.length)} of ${currentResults.length}`;

  if (currentResults.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 16px; color: var(--text-muted);">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
        <div style="font-size: 1rem; font-weight: 600; color: var(--text-secondary);">No ancestors found</div>
        <p style="font-size: 0.85rem; margin-top: 4px;">Try a different name, town, or filter chip.</p>
      </div>
    `;
    loadMoreBtn.style.display = 'none';
    return;
  }

  const itemsToRender = currentResults.slice(0, displayLimit);
  container.innerHTML = itemsToRender.map(p => createPersonCardHtml(p)).join('');

  if (currentResults.length > displayLimit) {
    loadMoreBtn.style.display = 'block';
  } else {
    loadMoreBtn.style.display = 'none';
  }
}

function loadMoreResults() {
  displayLimit += 50;
  renderSearchResults();
}

function createPersonCardHtml(p) {
  const sideClass = p.s === 'jerome' ? 'badge-jerome' : (p.s === 'amy' ? 'badge-amy' : '');
  const sideLabel = p.s === 'jerome' ? "Jerome's Line" : (p.s === 'amy' ? "Amy's Line" : "Relative");
  
  let genText = '';
  if (p.gen !== null && p.gen !== undefined) {
    if (p.gen === 0) genText = '• Self';
    else if (p.gen === 1) genText = '• Parent';
    else if (p.gen === 2) genText = '• Grandparent';
    else if (p.gen === 3) genText = '• Great-Grandparent';
    else genText = `• Gen ${p.gen}`;
  }

  const birthText = p.b || (p.bp ? p.bp.split(',')[0] : 'Unknown');
  const deathText = p.d || (p.dp ? p.dp.split(',')[0] : 'Unknown');

  const tagsHtml = (p.tags || []).map(t => {
    let tClass = 'tag-loc';
    if (t.type === 'war') tClass = 'tag-war';
    if (t.type === 'immigrant') tClass = 'tag-immigrant';
    return `<span class="tag-pill ${tClass}">${escapeHtml(t.label)}</span>`;
  }).join('');

  return `
    <div class="person-card" onclick="openPersonModal('${p.id}')">
      <div class="card-top">
        <div class="card-name">${escapeHtml(p.n)}</div>
        <span class="badge-side ${sideClass}">${sideLabel} ${genText}</span>
      </div>
      <div class="card-vitals">
        <div class="vital-line">
          <span style="color:var(--text-muted); font-size:0.75rem;">★</span>
          <span>${escapeHtml(p.b || '—')} ${p.bp ? '• ' + escapeHtml(p.bp) : ''}</span>
        </div>
        ${(p.d || p.dp) ? `
        <div class="vital-line">
          <span style="color:var(--text-muted); font-size:0.75rem;">†</span>
          <span>${escapeHtml(p.d || '—')} ${p.dp ? '• ' + escapeHtml(p.dp) : ''}</span>
        </div>` : ''}
      </div>
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
    </div>
  `;
}

// ================= INTERACTIVE TREE VIEW =================
function setTreeRoot(side) {
  document.getElementById('btnRootJerome').classList.toggle('active', side === 'jerome');
  document.getElementById('btnRootAmy').classList.toggle('active', side === 'amy');
  currentTreeRootId = side === 'jerome' ? (data.roots?.jerome || 'PW92-F2S') : (data.roots?.amy || 'PW92-6SQ');
  renderTree();
}

function renderTree() {
  const container = document.getElementById('treeCanvas');
  const rootPerson = people[currentTreeRootId];
  if (!rootPerson) {
    container.innerHTML = '<p style="color:var(--text-muted);">Root person not found.</p>';
    return;
  }

  // Render 4 levels of ancestors starting from root
  let html = `<div style="display:flex; flex-direction:column; gap:20px;">`;
  html += renderTreeNodeLevel([currentTreeRootId], 0);
  html += `</div>`;
  container.innerHTML = html;
}

function renderTreeNodeLevel(personIds, level) {
  if (level > 3 || personIds.length === 0) return '';
  
  const levelNames = ['Self', 'Parents', 'Grandparents', 'Great-Grandparents'];
  const nextGenParents = [];

  let rowHtml = `
    <div>
      <div style="font-size:0.75rem; text-transform:uppercase; color:var(--accent-gold); font-weight:700; margin-bottom:8px; letter-spacing:0.04em;">
        ${levelNames[level] || `Generation ${level}`}
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
  `;

  for (const pid of personIds) {
    const p = people[pid];
    if (p) {
      if (p.p && p.p.length > 0) {
        p.p.forEach(parentId => nextGenParents.push(parentId));
      }
      rowHtml += `
        <div class="tree-node-card" onclick="openPersonModal('${p.id}')">
          <div style="font-weight:700; color:#fff; font-size:0.92rem;">${escapeHtml(p.n)}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
            ${escapeHtml(p.b ? p.b.slice(0, 10) : '—')} – ${escapeHtml(p.d ? p.d.slice(0, 10) : 'Living')}
          </div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">
            ID: ${p.id}
          </div>
        </div>
      `;
    }
  }

  rowHtml += `</div></div>`;

  if (nextGenParents.length > 0 && level < 3) {
    rowHtml += renderTreeNodeLevel(nextGenParents, level + 1);
  }

  return rowHtml;
}

// ================= WAR STORIES =================
function renderWarStories() {
  const container = document.getElementById('storyGrid');
  const stories = data.warStories || [];

  container.innerHTML = stories.map(s => {
    const peopleButtons = (s.people || []).map(pid => {
      const p = people[pid];
      const pName = p ? p.n : pid;
      return `<button class="ancestor-link-btn" onclick="openPersonModal('${pid}')">👤 ${escapeHtml(pName)}</button>`;
    }).join('');

    return `
      <div class="story-card">
        <div class="story-header">
          <span class="story-conflict">${escapeHtml(s.conflict)}</span>
          <span class="story-year">${escapeHtml(s.year)}</span>
        </div>
        <h3 class="story-title">${escapeHtml(s.title)}</h3>
        <p class="story-body">${escapeHtml(s.summary)}</p>
        <div>
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:4px;">
            Documented Ancestors
          </div>
          <div class="story-ancestors">
            ${peopleButtons}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ================= IMMIGRATION TIMELINE =================
function renderImmigrationTimeline() {
  const container = document.getElementById('timelineList');
  const timeline = data.immigrantStories || [];

  container.innerHTML = timeline.map(item => {
    const peopleButtons = (item.immigrants || []).map(pid => {
      const p = people[pid];
      const pName = p ? p.n : pid;
      return `<button class="ancestor-link-btn" onclick="openPersonModal('${pid}')">👤 ${escapeHtml(pName)}</button>`;
    }).join('');

    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-year">${escapeHtml(item.year)}</div>
        <div class="timeline-card">
          <div class="timeline-title">${escapeHtml(item.family)} ➔ ${escapeHtml(item.dest)}</div>
          <div class="timeline-desc">${escapeHtml(item.desc)}</div>
          <div class="story-ancestors">
            ${peopleButtons}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ================= MODAL / BOTTOM SHEET =================
function openPersonModal(pid) {
  const p = people[pid];
  if (!p) return;

  const modal = document.getElementById('personModal');
  const badge = document.getElementById('modalSideBadge');
  const nameEl = document.getElementById('modalName');
  const idEl = document.getElementById('modalId');
  const tagsEl = document.getElementById('modalTags');
  const birthEl = document.getElementById('modalBirth');
  const deathEl = document.getElementById('modalDeath');
  const burialEl = document.getElementById('modalBurial');
  const parentsEl = document.getElementById('modalParents');
  const spousesEl = document.getElementById('modalSpouses');
  const childrenEl = document.getElementById('modalChildren');
  const fsLink = document.getElementById('modalFsLink');

  // Side badge
  badge.className = 'badge-side ' + (p.s === 'jerome' ? 'badge-jerome' : 'badge-amy');
  badge.textContent = p.s === 'jerome' ? "Jerome's Ancestry" : (p.s === 'amy' ? "Amy's Ancestry" : "Relative");

  nameEl.textContent = p.n;
  idEl.textContent = `FamilySearch ID: ${p.id}`;

  // Tags
  tagsEl.innerHTML = (p.tags || []).map(t => {
    let tClass = 'tag-loc';
    if (t.type === 'war') tClass = 'tag-war';
    if (t.type === 'immigrant') tClass = 'tag-immigrant';
    return `<span class="tag-pill ${tClass}">${escapeHtml(t.label)}</span>`;
  }).join('');

  // Vitals
  birthEl.innerHTML = `<div>${escapeHtml(p.b || '—')}</div><div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(p.bp || '')}</div>`;
  deathEl.innerHTML = `<div>${escapeHtml(p.d || '—')}</div><div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(p.dp || '')}</div>`;
  burialEl.textContent = p.bu || 'Not recorded';

  // Parents
  if (p.p && p.p.length > 0) {
    parentsEl.innerHTML = p.p.map(parentId => {
      const parent = people[parentId];
      return createRelItemHtml(parentId, parent ? parent.n : parentId, 'Parent');
    }).join('');
  } else {
    parentsEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">None recorded in database</div>';
  }

  // Spouses
  if (p.sp && p.sp.length > 0) {
    spousesEl.innerHTML = p.sp.map(spouseId => {
      const spouse = people[spouseId];
      return createRelItemHtml(spouseId, spouse ? spouse.n : spouseId, 'Spouse');
    }).join('');
  } else {
    spousesEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">None recorded in database</div>';
  }

  // Children
  if (p.c && p.c.length > 0) {
    childrenEl.innerHTML = p.c.map(childId => {
      const child = people[childId];
      return createRelItemHtml(childId, child ? child.n : childId, 'Child');
    }).join('');
  } else {
    childrenEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">None recorded in database</div>';
  }

  // FamilySearch Link
  fsLink.href = `https://www.familysearch.org/tree/person/details/${p.id}`;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function createRelItemHtml(pid, name, role) {
  return `
    <div class="rel-item" onclick="openPersonModal('${pid}')">
      <div>
        <div class="rel-name">${escapeHtml(name)}</div>
        <div class="rel-role">${role} • ID: ${pid}</div>
      </div>
      <span style="color:var(--accent-gold); font-size:1.1rem;">›</span>
    </div>
  `;
}

function closeModal() {
  document.getElementById('personModal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'personModal') {
    closeModal();
  }
}

// Helper escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

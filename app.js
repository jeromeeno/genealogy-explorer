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
  
  if (tabId === 'map' && googleMapInstance) {
    google.maps.event.trigger(googleMapInstance, 'resize');
    const hubs = getEffectiveMapHubs();
    if (currentMapLine === 'jerome') {
      const jeromeBounds = new google.maps.LatLngBounds();
      hubs.filter(l => l.side === 'jerome').forEach(l => {
        jeromeBounds.extend(new google.maps.LatLng(l.coords.lat, l.coords.lng));
      });
      googleMapInstance.fitBounds(jeromeBounds);
    } else if (currentMapLine === 'amy') {
      const amyBounds = new google.maps.LatLngBounds();
      hubs.filter(l => l.side === 'amy').forEach(l => {
        amyBounds.extend(new google.maps.LatLng(l.coords.lat, l.coords.lng));
      });
      googleMapInstance.fitBounds(amyBounds);
    } else if (mapInitialBounds) {
      googleMapInstance.fitBounds(mapInitialBounds);
    }
  }

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
    if (currentFilter === 'antioquia') {
      const hasAnt = (p.tags || []).some(t => t.label.includes('Antioquia'));
      if (!hasAnt) return false;
    }
    if (currentFilter === 'alabama') {
      const hasAla = (p.tags || []).some(t => t.label.includes('Clarke'));
      if (!hasAla) return false;
    }
    if (currentFilter === 'swiss') {
      const hasSwi = (p.tags || []).some(t => t.label.includes('Lauenen'));
      if (!hasSwi) return false;
    }

    // 2. Text Search Matching
    if (currentSearchTerm) {
      const relStr = p.rel || getPersonRelationship(p);
      const originStr = p.origin || getPersonOrigin(p);
      const searchStr = `${p.n} ${p.id} ${p.bp} ${p.dp} ${p.bu} ${relStr} ${originStr}`.toLowerCase();
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

function getPersonRelationship(p) {
  if (!p) return '';
  if (p.rel) return p.rel;
  if (p.id === 'PW92-F2S') return 'Jerome Eno (You)';
  if (p.id === 'PW92-6SQ') return 'Amy Whisenhunt (Wife)';
  const target = p.s === 'jerome' ? 'Jerome' : 'Amy';
  const isF = (p.g === 'F');
  const gen = p.gen;
  if (gen === 1) return isF ? `Mother of ${target}` : `Father of ${target}`;
  if (gen === 2) return isF ? `Grandmother of ${target}` : `Grandfather of ${target}`;
  if (gen === 3) return isF ? `Great-grandmother of ${target}` : `Great-grandfather of ${target}`;
  if (gen !== null && gen !== undefined && gen >= 4) {
    const k = gen - 2;
    const suffix = (10 <= k % 100 && k % 100 <= 20) ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[k % 10] || 'th');
    const role = isF ? 'great-grandmother' : 'great-grandfather';
    return `${k}${suffix} ${role} of ${target}`;
  }
  return `Ancestor of ${target}`;
}

function getPersonOrigin(p) {
  if (!p) return 'Origin Unknown';
  if (p.origin) return p.origin;
  if (p.geo && p.geo.name) return p.geo.name;
  const raw = (p.bp || p.dp || p.bu || '').trim();
  if (!raw) return 'Origin Unknown';
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return raw;
}

function createPersonCardHtml(p) {
  const isJerome = p.s === 'jerome';
  const sideClass = isJerome ? 'badge-jerome' : (p.s === 'amy' ? 'badge-amy' : '');
  const sideLabel = isJerome ? "Jerome's Line" : (p.s === 'amy' ? "Amy's Line" : "Relative");
  const relText = getPersonRelationship(p);
  const relClass = isJerome ? 'card-relation-jerome' : 'card-relation-amy';
  const sideIcon = isJerome ? '⚜️' : '🌸';
  const originText = getPersonOrigin(p);

  const genBadge = p.gen !== null && p.gen !== undefined ? `Gen ${p.gen}` : '';

  const tagsHtml = (p.tags || []).map(t => {
    let tClass = 'tag-loc';
    if (t.type === 'war') tClass = 'tag-war';
    if (t.type === 'immigrant') tClass = 'tag-immigrant';
    return `<span class="tag-pill ${tClass}">${escapeHtml(t.label)}</span>`;
  }).join('');

  return `
    <div class="person-card" onclick="openPersonModal('${p.id}')">
      <div class="card-top">
        <div style="flex:1; min-width:0;">
          <div class="card-name">${escapeHtml(p.n)}</div>
          <div class="card-relation-text ${relClass}">
            <span>${sideIcon}</span> <span>${escapeHtml(relText)}</span>
          </div>
        </div>
        <span class="badge-side ${sideClass}">${sideLabel} ${genBadge ? '• ' + genBadge : ''}</span>
      </div>
      <div class="card-origin-line" title="${escapeHtml(originText)}">
        <span class="origin-pin">📍</span>
        <span class="origin-text">${escapeHtml(originText)}</span>
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
function setTreeRoot(mode) {
  document.querySelectorAll('.tree-root-btn').forEach(btn => btn.classList.remove('active'));
  
  if (mode === 'jerome') {
    document.getElementById('btnRootJerome')?.classList.add('active');
    currentTreeRootId = 'PW92-F2S';
  } else if (mode === 'amy') {
    document.getElementById('btnRootAmy')?.classList.add('active');
    currentTreeRootId = 'PW92-6SQ';
  } else if (mode === 'founders') {
    document.getElementById('btnRootFounders')?.classList.add('active');
    currentTreeRootId = 'founders';
  }
  
  renderTree();
}

function renderTree() {
  const container = document.getElementById('treeCanvas');
  
  if (currentTreeRootId === 'founders') {
    renderFoundersTree(container);
    return;
  }

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

function renderFoundersTree(container) {
  const founderCards = [
    { id: 'GM4N-59X', role: 'Progenitor of Eno Family (Carignan-Salières, 1665)', ship: 'Le Paix (1665)', origin: 'Lisieux, Normandy ➔ Berthier/Sorel' },
    { id: 'MBYF-JY1', role: 'Fille du Roi (King\'s Dowry 1668, Wife of Jacques)', ship: 'La Nouvelle-France (1668)', origin: 'Paris, Île-de-France ➔ Montreal' },
    { id: '9XRB-RLG', role: 'Founding Acadian Patriarch of Caissie Family', ship: 'La Rochelle Expedition (1665)', origin: 'France ➔ Port-Royal, Acadia' },
    { id: 'KNHM-2WS', role: 'Pioneer of Acadia (Razilly Expedition 1632)', ship: 'L\'Espérance-en-Dieu (1632)', origin: 'Martaizé, Poitou ➔ Port-Royal' },
    { id: 'LBNL-4LN', role: 'Percheron Pioneer & Master Carpenter', ship: 'Giffard Fleet (1634)', origin: 'Mortagne-au-Perche ➔ Quebec' },
    { id: 'LRCC-3XL', role: 'Frontier Defender & Martyr (Cap-Rouge 1653)', ship: 'Arrived ~1638', origin: 'Bagneux, France ➔ Cap-Rouge' },
    { id: 'LZ8C-GTL', role: 'Hero of Rivière-Ouelle Shoreline Ambush (1690)', ship: 'Arrived 1641', origin: 'Tourouvre, Perche ➔ Rivière-Ouelle' },
    { id: 'LYF3-4HN', role: 'Defender of Rivière-Ouelle against Phips (1690)', ship: 'Arrived 1665', origin: 'Lizotte, Normandy ➔ Rivière-Ouelle' },
    { id: '9KDS-BKX', role: '3e Baron de Saint-Castin & Penobscot War Chief', ship: 'Carignan-Salières (1665)', origin: 'Béarn, France ➔ Castine, Maine' },
    { id: 'PWHF-6JL', role: 'Breton Ancestor (Hénault Branch)', ship: 'Breton Line (~1600)', origin: 'Vannes, Brittany, France' }
  ];

  let html = `
    <div style="margin-bottom:16px;">
      <h3 style="font-size:1.15rem; font-weight:800; color:#fff;">⚜️ 17th-Century French & Acadian Founders</h3>
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px; line-height:1.5;">
        The direct ancestors who braved the transatlantic crossing in the 1600s aboard wooden sailing vessels to establish New France and Acadia. Tap any card to view their biography and ancestral mini-map.
      </p>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
  `;

  founderCards.forEach(f => {
    const p = people[f.id];
    if (!p) return;
    html += `
      <div class="tree-node-card" onclick="openPersonModal('${p.id}')">
        <div style="font-size:0.68rem; color:var(--accent-gold); font-weight:700; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.04em;">
          ${escapeHtml(f.role)}
        </div>
        <div style="font-weight:700; color:#fff; font-size:0.95rem;">${escapeHtml(p.n)}</div>
        <div style="font-size:0.72rem; color:#fcd34d; font-weight:600; margin-top:1px;">
          ⚜️ ${escapeHtml(getPersonRelationship(p))}
        </div>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
          ${escapeHtml(p.b || '—')} – ${escapeHtml(p.d || '—')}
        </div>
        <div class="tree-geo-pill" style="margin-top:6px;">
          ⛵ ${escapeHtml(f.origin)}
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
          Ship: ${escapeHtml(f.ship)} • ID: ${p.id}
        </div>
      </div>
    `;
  });

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
      const isJerome = p.s === 'jerome';
      const icon = isJerome ? '⚜️' : '🌸';
      rowHtml += `
        <div class="tree-node-card" onclick="openPersonModal('${p.id}')">
          <div style="font-size:0.68rem; font-weight:700; color:${isJerome ? 'var(--accent-gold)' : '#f472b6'}; margin-bottom:2px;">
            ${icon} ${escapeHtml(getPersonRelationship(p))}
          </div>
          <div style="font-weight:700; color:#fff; font-size:0.92rem;">${escapeHtml(p.n)}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
            ${escapeHtml(p.b ? p.b.slice(0, 10) : '—')} – ${escapeHtml(p.d ? p.d.slice(0, 10) : 'Living')}
          </div>
          <div class="tree-geo-pill" style="margin-top:6px;">📍 ${escapeHtml(getPersonOrigin(p))}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
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
      const relStr = p ? getPersonRelationship(p) : '';
      return `<button class="ancestor-link-btn" onclick="openPersonModal('${pid}')">👤 ${escapeHtml(pName)}${relStr ? ` <span class="btn-subtext">(${escapeHtml(relStr)})</span>` : ''}</button>`;
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
        ${s.geo ? `
          <div style="margin-top:10px;">
            <button class="btn-geo-action" onclick="focusOnMapLocation(${s.geo.lat}, ${s.geo.lng}, '${escapeHtml(s.title)}')">
              🗺️ Locate on Historical Map
            </button>
          </div>
        ` : ''}
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
      const relStr = p ? getPersonRelationship(p) : '';
      return `<button class="ancestor-link-btn" onclick="openPersonModal('${pid}')">👤 ${escapeHtml(pName)}${relStr ? ` <span class="btn-subtext">(${escapeHtml(relStr)})</span>` : ''}</button>`;
    }).join('');

    const eraLabel = item.era === '17th' ? '17e Siècle (1600s)' :
                     item.era === '18th' ? '18e Siècle (1700s)' :
                     item.era === '19th' ? '19e Siècle (1800s)' : '20e Siècle (1900s+)';

    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-year">${escapeHtml(item.year)}</div>
        <div class="timeline-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span class="story-conflict" style="font-size:0.68rem;">${eraLabel}</span>
          </div>
          <div class="timeline-title">${escapeHtml(item.family)} ➔ ${escapeHtml(item.dest)}</div>
          <div class="timeline-desc">${escapeHtml(item.desc)}</div>
          <div class="story-ancestors" style="margin-top:6px;">
            ${peopleButtons}
          </div>
          ${item.geo ? `
            <div style="margin-top:10px;">
              <button class="btn-geo-action" onclick="focusOnMapLocation(${item.geo.lat}, ${item.geo.lng}, '${escapeHtml(item.family)}')">
                🗺️ Trace Migration on Map
              </button>
            </div>
          ` : ''}
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
  const isJerome = p.s === 'jerome';
  const relText = getPersonRelationship(p);
  const originText = getPersonOrigin(p);
  currentModalGeo = p.geo;
  currentModalSide = p.s;

  badge.className = 'badge-side ' + (isJerome ? 'badge-jerome' : 'badge-amy');
  badge.textContent = isJerome ? "Jerome's Line" : "Amy's Line";

  const relEl = document.getElementById('modalRelation');
  if (relEl) {
    relEl.className = 'modal-relation-banner ' + (isJerome ? 'banner-jerome' : 'banner-amy');
    relEl.innerHTML = `<span>${isJerome ? '⚜️' : '🌸'}</span> <span>${escapeHtml(relText)}</span>`;
  }

  const originEl = document.getElementById('modalOrigin');
  if (originEl) {
    originEl.textContent = '📍 ' + originText;
  }

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
  // Ancestral Geography & Mini-Map Card
  const geoSection = document.getElementById('modalGeoSection');
  const geoLocationEl = document.getElementById('modalGeoLocation');
  if (p.geo && p.geo.lat && p.geo.lng) {
    if (geoLocationEl) geoLocationEl.textContent = p.geo.name;
    if (geoSection) geoSection.style.display = 'block';
    setTimeout(() => {
      renderPersonMiniMap(p.geo.lat, p.geo.lng, p.n);
    }, 180);
  } else {
    if (geoSection) geoSection.style.display = 'none';
  }

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
  const relP = people[pid];
  const relDesc = relP ? getPersonRelationship(relP) : `ID: ${pid}`;
  const relOrigin = relP ? getPersonOrigin(relP) : '';
  const isJerome = relP && relP.s === 'jerome';
  const icon = isJerome ? '⚜️' : '🌸';
  return `
    <div class="rel-item" onclick="openPersonModal('${pid}')">
      <div>
        <div class="rel-name">${escapeHtml(name)}</div>
        <div class="rel-role">${role} • <span style="color:${isJerome ? '#fcd34d' : '#f472b6'}; font-weight:600;">${icon} ${escapeHtml(relDesc)}</span> ${relOrigin && relOrigin !== 'Origin Unknown' ? '• 📍 ' + escapeHtml(relOrigin) : ''}</div>
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

// Mini-Map in Person Drawer
let personMiniMapInstance = null;
let personMiniMarker = null;
let currentModalGeo = null;

function renderPersonMiniMap(lat, lng, name) {
  const container = document.getElementById('personMiniMap');
  if (!container || !window.google || !google.maps) return;

  const latLng = { lat, lng };

  if (!personMiniMapInstance) {
    const darkStyles = [
      { elementType: "geometry", stylers: [{ color: "#171f2d" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#131b26" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#f8fafc" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#223147" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b111c" }] }
    ];

    personMiniMapInstance = new google.maps.Map(container, {
      center: latLng,
      zoom: 7,
      styles: darkStyles,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'cooperative'
    });

    personMiniMarker = new google.maps.Marker({
      position: latLng,
      map: personMiniMapInstance,
      title: name,
      icon: {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#f59e0b",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
        scale: 1.3,
        anchor: new google.maps.Point(12, 22)
      }
    });
  } else {
    google.maps.event.trigger(personMiniMapInstance, 'resize');
    personMiniMapInstance.setCenter(latLng);
    personMiniMapInstance.setZoom(7);
    if (personMiniMarker) {
      personMiniMarker.setPosition(latLng);
      personMiniMarker.setTitle(name);
    }
  }
}

function openPersonOnMainMap() {
  if (!currentModalGeo) return;
  const targetGeo = currentModalGeo;
  const targetSide = currentModalSide;
  closeModal();
  switchTab('map');
  setTimeout(() => {
    if (targetSide && currentMapLine !== 'all' && currentMapLine !== targetSide) {
      const chip = document.getElementById(targetSide === 'jerome' ? 'chipLineJerome' : 'chipLineAmy');
      setMapLine(targetSide, chip);
    }
    focusOnMapLocation(targetGeo.lat, targetGeo.lng, targetGeo.name, 9);
  }, 250);
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

// ================= GOOGLE MAPS PLATFORM =================
let googleMapInstance = null;
let mapMarkers = [];
let mapPolylines = [];
let mapInitialBounds = null;
let currentMapLine = 'jerome';
let currentMapEra = 'all';
let currentMapCategory = 'all';

const MAP_LOCATIONS = [
  // ================= JEROME'S LINE (FRENCH-CANADIAN & ACADIAN) =================
  // --- 17th Century (1600s): French Departure Ports & Provinces ---
  {
    id: 'lisieux',
    title: 'Lisieux, Normandy, France',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 49.1458, lng: 0.2278 },
    desc: 'Cradle of the Eno family line. Norman birthplace of Carignan-Salières soldier Jacques Énaud dit Canada (~1636), who sailed aboard Le Paix in 1665 to defend New France.',
    people: ['GM4N-59X']
  },
  {
    id: 'paris',
    title: 'Paris, Île-de-France, France',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 48.8566, lng: 2.3522 },
    desc: 'Origin of Fille du Roi Marie Leroux (~1647), who crossed the Atlantic in 1668 with King Louis XIV\'s royal dowry and married Jacques Énaud in Montreal.',
    people: ['MBYF-JY1']
  },
  {
    id: 'la-rochelle',
    title: 'La Rochelle, Aunis, France',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 46.1603, lng: -1.1511 },
    desc: 'The historic Atlantic embarkation port for 17th-century French pioneers sailing for Acadia and Quebec, including Acadian patriarch Roger Jean Caissy (1665).',
    people: ['9XRB-RLG', 'KNHM-2WS']
  },
  {
    id: 'perche',
    title: 'Mortagne-au-Perche & Tourouvre, France',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 48.5206, lng: 0.5456 },
    desc: 'The Percheron pioneer cradle. Home of master carpenter Zacharie Cloutier, who sailed in 1634 with Robert Giffard\'s expedition to found Quebec, and Jean Pelletier.',
    people: ['LBNL-4LN', 'LZ8C-GTL']
  },
  {
    id: 'poitou',
    title: 'Martaizé & Poitou, France',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 46.9172, lng: 0.0617 },
    desc: 'The ancestral homeland of early Acadian settlers. Origin of Pierre Comeau I, who sailed in 1632 aboard L\'Espérance-en-Dieu with Commander Isaac de Razilly.',
    people: ['KNHM-2WS']
  },
  {
    id: 'vannes',
    title: 'Vannes & Brittany, France',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 47.6582, lng: -2.7608 },
    desc: 'Breton origin of Yves Hénault, born ~1600 on the coast of the Gulf of Morbihan, Brittany.',
    people: ['PWHF-6JL']
  },
  {
    id: 'dieppe',
    title: 'Dieppe, Normandy, France',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 49.9246, lng: 1.0775 },
    desc: 'Channel port where 17th-century ships Le Paix, Saint-Sébastien, and the royal expeditionary fleets took on provisions for the Atlantic crossing to Quebec.',
    people: ['GM4N-59X']
  },

  // --- 17th Century (1600s): Early New France & Acadia Settlements ---
  {
    id: 'port-royal',
    title: 'Port-Royal, Acadia',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 44.7431, lng: -65.5172 },
    desc: 'The first permanent French settlement in North America (1605/1632). Acadian home of Roger Jean Caissy (1665) and Pierre Comeau (1632), ancestors to over 300 years of Maritimes family history.',
    people: ['9XRB-RLG', 'KNHM-2WS']
  },
  {
    id: 'quebec-city',
    title: 'Quebec City & Côte de Beaupré',
    side: 'jerome',
    category: 'immigration',
    era: '17th',
    coords: { lat: 46.8139, lng: -71.2082 },
    desc: 'The capital of New France. Disembarkation point for Jacques Énaud (1665 aboard Le Paix), Marie Leroux (1668), and master carpenter Zacharie Cloutier (1634).',
    people: ['GM4N-59X', 'MBYF-JY1', 'LBNL-4LN']
  },
  {
    id: 'cap-rouge',
    title: 'Cap-Rouge, Quebec',
    side: 'jerome',
    category: 'battle',
    era: '17th',
    coords: { lat: 46.7500, lng: -71.3500 },
    desc: 'Site of the June 10, 1653 Iroquois ambush and martyrdom of Pierre LePicard-Gareman while defending his 10-year-old son Charles on the St. Lawrence frontier.',
    people: ['LRCC-3XL']
  },
  {
    id: 'berthier',
    title: 'Berthierville & Sorel, Quebec',
    side: 'jerome',
    category: 'battle',
    era: '17th',
    coords: { lat: 46.0667, lng: -73.1833 },
    desc: 'Frontier land grant conceded in 1665 to Carignan-Salières veteran Jacques Énaud dit Canada to guard the strategic mouth of the Richelieu River against Iroquois war parties.',
    people: ['GM4N-59X', 'LTC5-FPN', 'GFD9-BK2', 'G7PZ-WRB', 'LCXY-QZ1']
  },
  {
    id: 'riviere-ouelle',
    title: 'Rivière-Ouelle, Quebec',
    side: 'jerome',
    category: 'battle',
    era: '17th',
    coords: { lat: 47.4333, lng: -70.0167 },
    desc: 'Site of the October 1690 shoreline ambush during King William\'s War. 39 armed settlers, including ancestors Jean Pelletier and Guillaume Lizotte, repelled Sir William Phips\' English armada.',
    people: ['LZ8C-GTL', 'LYF3-4HN']
  },
  {
    id: 'castine',
    title: 'Pentagouet (Castine), Maine',
    side: 'jerome',
    category: 'battle',
    era: '17th',
    coords: { lat: 44.3881, lng: -68.7997 },
    desc: 'Frontier post founded by Jean-Vincent d\'Abbadie, 3e Baron de Saint-Castin, who married Pidianské, daughter of Grand Sagamore Madockawando, uniting French and Abenaki bloodlines.',
    people: ['9KDS-BKX', 'L4SP-V3B']
  },
  {
    id: 'pemaquid',
    title: 'Fort William Henry (Pemaquid), Maine',
    side: 'jerome',
    category: 'battle',
    era: '17th',
    coords: { lat: 43.8797, lng: -69.5250 },
    desc: 'Formidable English stone fortress besieged and captured in August 1696 by Baron de Saint-Castin and Pierre Le Moyne d\'Iberville commanding 500 Abenaki warriors in war canoes.',
    people: ['9KDS-BKX']
  },

  // --- 18th Century (1700s): Frontier Raids & Deportation ---
  {
    id: 'groton',
    title: 'Groton, Massachusetts',
    side: 'jerome',
    category: 'battle',
    era: '18th',
    coords: { lat: 42.6112, lng: -71.5745 },
    desc: 'Scene of the Queen Anne\'s War raid on August 8, 1704. 14-year-old Matthias Farnsworth was captured in the fields and marched 300 miles barefoot to Montreal, founding the Phaneuf dynasty.',
    people: ['LKK6-RYV']
  },
  {
    id: 'grand-pre',
    title: 'Grand-Pré & Petitcodiac, Acadia',
    side: 'jerome',
    category: 'battle',
    era: '18th',
    coords: { lat: 45.1084, lng: -64.3094 },
    desc: 'Site of the 1755 Grand Dérangement. Acadian partisan fighter Charles Maillet led armed guerrilla resistance along the Petitcodiac until captured at gunpoint by British Rangers in 1756.',
    people: ['LW1B-ZMR']
  },
  {
    id: 'yorktown',
    title: 'Yorktown, Virginia',
    side: 'jerome',
    category: 'battle',
    era: '18th',
    coords: { lat: 37.2388, lng: -76.5097 },
    desc: 'October 1781 Siege of Yorktown. Captain Antoine Paulin served in Colonel Moses Hazen\'s 2nd Canadian Regiment under George Washington when General Cornwallis surrendered.',
    people: ['L4WD-WP8']
  },

  // --- 19th Century (1800s): The New England Mill Exodus ---
  {
    id: 'saint-valentin',
    title: 'Saint-Valentin, Quebec',
    side: 'jerome',
    category: 'immigration',
    era: '19th',
    coords: { lat: 45.1833, lng: -73.3167 },
    desc: 'Richelieu River farming parish. Birthplace of Pierre Eno (1882) and home of William Eno. The tragic 1884 death of Josephine Poirier prompted William to relocate his children to Lowell.',
    people: ['LB2Q-2LK', '9NF5-87T', 'GV5P-3RH', 'LDHZ-S4B']
  },
  {
    id: 'rimouski',
    title: 'Kamouraska & Rimouski, Quebec',
    side: 'jerome',
    category: 'immigration',
    era: '19th',
    coords: { lat: 48.4488, lng: -68.5240 },
    desc: 'Lower St. Lawrence parishes of the Michaud, Ouellette, Normand, and Hudon families prior to their departure for the Fall River cotton textile mills.',
    people: ['99H8-3PS', 'LZKF-68P', 'LYGW-92H', 'LYGW-92X']
  },
  {
    id: 'lowell',
    title: 'Lowell, Massachusetts',
    side: 'jerome',
    category: 'immigration',
    era: '19th',
    coords: { lat: 42.6425, lng: -71.3162 },
    desc: 'The historic Franco-American industrial heartland. Destination for William & Pierre Eno (~1888), Alexis & Albina Lamarre (~1886), Joseph Henri L\'Heureux (1875), and Napoleon Phaneuf (~1872).',
    people: ['GHYM-322', '9NF5-87T', 'LB2Q-2LK', '9NF5-871', 'GLRP-DPJ', 'K266-GQ5', 'K2TL-BCX', '9VNH-9FG']
  },
  {
    id: 'fallriver',
    title: 'Fall River, Massachusetts',
    side: 'jerome',
    category: 'cemetery',
    era: '19th',
    coords: { lat: 41.7015, lng: -71.1550 },
    desc: 'Textile mill community and site of Notre Dame Cemetery, where 3rd great-grandparents Augustin Normand (1896) and Emélie Hudon (1907) are interred. Joseph Michaud died here in 1921.',
    people: ['LYGW-92H', 'LYGW-92X', '99H8-3PS', 'LZKF-68P', 'L7D1-LT4', 'L5PJ-F8K']
  },

  // --- 20th Century (1900s): Maritime Homeland & Mom\'s Arrival ---
  {
    id: 'saint-ignace',
    title: 'Saint-Ignace, Kent Co., New Brunswick',
    side: 'jerome',
    category: 'immigration',
    era: '20th',
    coords: { lat: 46.7167, lng: -64.9667 },
    desc: 'The 300-year Acadian homeland of the Caissie and Gallant families, who stayed in the Maritimes until Diane Caissie and father Eugene immigrated to Massachusetts in 1963.',
    people: ['PW92-7TK', 'G3ZY-8HH', 'PW92-ZRG', 'P9GJ-VQK', 'GDQD-SQH']
  },

  // ================= AMY'S LINE (COLOMBIAN PAISA, SWISS & SOUTHERN FRONTIER) =================
  {
    id: 'medellin',
    title: 'Medellín, Antioquia, Colombia',
    side: 'amy',
    category: 'immigration',
    era: '19th',
    coords: { lat: 6.2442, lng: -75.5812 },
    desc: 'The vibrant capital of Antioquia nestled in the Aburrá Valley. The central cultural, commercial, and family center for multiple generations of Quiroz, Hoyos, and Hernández ancestors.',
    people: ['GX5P-CXK', 'GJW4-THJ', 'GJ8R-26P', 'GJ8T-SKH', 'GJ8R-5LP', 'GJ8R-K2X', 'GVT9-QT3', 'GVT9-WXB']
  },
  {
    id: 'rionegro',
    title: 'Rionegro & Marinilla, Antioquia, Colombia',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 6.1552, lng: -75.3737 },
    desc: 'The historic colonial cradle of the Paisa civilization. Mountain valley parishes where 16th and 17th-century Spanish pioneers established estates and founded the Restrepo, López, and Trujillo lines.',
    people: ['GQTN-T7X', 'LBTV-TXB', 'LDPN-CZ1', 'GQVT-LHQ', 'LR1X-V2H', 'LYCR-RL6', 'GB5B-4DQ', 'GB5B-8PS']
  },
  {
    id: 'santa-fe-antioquia',
    title: 'Santa Fe de Antioquia, Colombia',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 6.5569, lng: -75.8281 },
    desc: 'Founded in 1541 by Marshal Jorge Robledo on the banks of the Cauca River. The historic colonial capital of Antioquia during the Spanish Empire.',
    people: ['GQTN-T7X', 'LYCR-RL6']
  },
  {
    id: 'popayan',
    title: 'Popayán & Buga, Colombia',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 2.4419, lng: -76.6063 },
    desc: 'Founded in 1537 by Sebastián de Belalcázar. Historic aristocratic and religious center of southwestern Colombia, home to early Caldas, Grueso, and Segura forebears.',
    people: ['KCKB-NZL', 'L7HV-M8J', 'LZ2L-MYG', '2Z39-HC4', 'KH3W-VYC', 'KHT1-TW2', '2Z39-4FT', '2Z39-Z65']
  },
  {
    id: 'socorro',
    title: 'Socorro, Santander, Colombia',
    side: 'amy',
    category: 'battle',
    era: '18th',
    coords: { lat: 6.4678, lng: -73.2612 },
    desc: 'Epicenter of the famous 1781 Comuneros Revolt (Rebelión de los Comuneros) where townspeople rose up against Spanish royal taxation, an early spark of South American independence.',
    people: ['GJW4-THJ', 'GJ8R-26P']
  },
  {
    id: 'grove-hill',
    title: 'Grove Hill & Clarke County, Alabama',
    side: 'amy',
    category: 'cemetery',
    era: '19th',
    coords: { lat: 31.7088, lng: -87.7778 },
    desc: 'The pine belt farmland where Whisenhunt pioneer ancestors cleared homesteads, built churches, and farmed for over a century following their migration south from the Carolinas.',
    people: ['G3YH-6FX', 'GH23-RT8', 'LBPY-5S2', 'LBGD-HQZ', 'L7J1-94M', 'LHR8-JJJ', 'GQDB-BS4', 'K4NK-L8G']
  },
  {
    id: 'knox-tn',
    title: 'Knox County, Tennessee',
    side: 'amy',
    category: 'immigration',
    era: '18th',
    coords: { lat: 35.9606, lng: -83.9207 },
    desc: 'East Tennessee Appalachian frontier waypoint along the Great Valley road where Whisenhunt and pioneer families gathered before migrating southwest into Alabama.',
    people: ['K4NK-L8G', 'LBPY-5S2']
  },
  {
    id: 'virginia-colonial',
    title: 'Henrico & New Kent, Colonial Virginia',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 37.5407, lng: -77.4360 },
    desc: 'Early 17th-century English colonial settlements along the James River where early planters established tobacco homesteads under the Virginia Company charter.',
    people: ['GS3R-S3B', 'KH7V-F79', 'LCCX-WBX']
  },
  {
    id: 'richmond-va',
    title: 'Richmond & Henrico County, Virginia',
    side: 'amy',
    category: 'cemetery',
    era: '20th',
    coords: { lat: 37.5407, lng: -77.4360 },
    desc: '20th-century home of William Madison Wade Jr. and British war bride Ena Dorothy Wainwright following WWII. Final resting place at Forest Lawn Cemetery.',
    people: ['L1LQ-KVD', 'L1LQ-VYF', 'PWS6-9H3']
  },
  {
    id: 'swearingen-fort',
    title: 'Swearingen\'s Fort (Fayette County, PA)',
    side: 'amy',
    category: 'battle',
    era: '18th',
    coords: { lat: 39.7820, lng: -79.8320 },
    desc: 'Pioneer stockade in Springhill Township built on a 468-acre tract, home to Captain Van Swearingen ("Indian Van") on the contested Ohio Valley frontier before the Revolution.',
    people: ['LB67-R2J']
  },
  {
    id: 'saratoga',
    title: 'Saratoga Battlefield, New York',
    side: 'amy',
    category: 'battle',
    era: '18th',
    coords: { lat: 43.0324, lng: -73.5878 },
    desc: '1777 Saratoga Campaign. Captain Van Swearingen commanded men in Daniel Morgan\'s elite rifle corps before being captured and personally interrogated by British General Simon Fraser.',
    people: ['LB67-R2J']
  },
  {
    id: 'stonington',
    title: 'Stonington & New London, Connecticut Colony',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 41.3437, lng: -71.9056 },
    desc: '17th-century Puritan maritime settlement on Long Island Sound, founding home of Captain Jesse Billings, Ebenezer Billings, Benjamin Hewitt, Mercy Palmer, and Deacon Gershom Palmer.',
    people: ['KNC1-RXH', 'LZP7-ZN8', 'LK51-DWM', 'LYVR-1VL', 'LBK1-54L', 'LZ6J-CR8', 'L2V6-225', '9N7L-VT9', 'LH6V-TTS']
  },
  {
    id: 'lauenen',
    title: 'Lauenen, Bern, Switzerland',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 46.4239, lng: 7.3236 },
    desc: 'High-altitude alpine parish in the Bernese Oberland of Switzerland, cradle of the Swiss ancestors (Sumi, Haldi, Annen) who later made the transatlantic crossing to America.',
    people: ['LC7W-N9J', 'LCJ2-YYR', 'GL7K-8H6', 'L71Z-4NJ', 'KV2R-T9R', 'LHDY-GTN', 'G3YJ-C1N', 'KJ6W-ZQH']
  },
  {
    id: 'ashby-de-la-zouch',
    title: 'Ashby-de-la-Zouch, Leicestershire, England',
    side: 'amy',
    category: 'immigration',
    era: '20th',
    coords: { lat: 52.7470, lng: -1.4700 },
    desc: 'Birthplace of Amy\'s maternal grandmother Ena Dorothy Wainwright (1923). Met American serviceman William Madison Wade Jr. during WWII, married in Leicestershire in 1944, and crossed the Atlantic as a British war bride to build her life in Virginia.',
    people: ['L1LQ-KVD']
  },
  {
    id: 'belton-england',
    title: 'Belton & Leicestershire, England',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 52.7844, lng: -1.3347 },
    desc: 'English village in the East Midlands, ancestral home of 17th-century English colonists who sailed across the Atlantic for North America.',
    people: ['GS3R-S3B', 'KH7V-F79']
  },
  {
    id: 'spain-madrid',
    title: 'Seville & Madrid, Spain',
    side: 'amy',
    category: 'immigration',
    era: '17th',
    coords: { lat: 40.4168, lng: -3.7038 },
    desc: 'The Spanish imperial kingdom from whose Atlantic ports galleons set sail for the Viceroyalty of New Granada, carrying the conquistadors and founders of Colombia.',
    people: ['LYCR-RL6', '2Z39-Z65']
  }
];

const MAP_ROUTES = [
  // ================= JEROME'S MIGRATION CORRIDORS =================
  {
    id: 'transatlantic-eno',
    side: 'jerome',
    era: '17th',
    name: '1665 Jacques Énaud / Le Paix Crossing (Normandy ➔ Quebec)',
    color: '#f59e0b',
    weight: 3,
    path: [
      { lat: 49.1458, lng: 0.2278 },   // Lisieux, Normandy
      { lat: 49.9246, lng: 1.0775 },   // Dieppe
      { lat: 50.5, lng: -15.0 },       // North Atlantic
      { lat: 48.5, lng: -45.0 },       // Grand Banks
      { lat: 47.5, lng: -60.0 },       // Gulf of St. Lawrence
      { lat: 46.8139, lng: -71.2082 }  // Quebec City
    ]
  },
  {
    id: 'transatlantic-acadia',
    side: 'jerome',
    era: '17th',
    name: '1632 & 1665 Acadian Crossing (La Rochelle ➔ Port-Royal)',
    color: '#10b981',
    weight: 3,
    path: [
      { lat: 46.1603, lng: -1.1511 },  // La Rochelle
      { lat: 45.0, lng: -20.0 },       // Mid-Atlantic
      { lat: 44.0, lng: -45.0 },
      { lat: 44.7431, lng: -65.5172 }  // Port-Royal, Acadia
    ]
  },
  {
    id: 'transatlantic-cloutier',
    side: 'jerome',
    era: '17th',
    name: '1634 Percheron Pioneer Crossing (Perche ➔ Quebec)',
    color: '#8b5cf6',
    weight: 2.5,
    path: [
      { lat: 48.5206, lng: 0.5456 },   // Mortagne-au-Perche
      { lat: 49.4432, lng: 0.1000 },   // Le Havre
      { lat: 49.0, lng: -25.0 },
      { lat: 47.0, lng: -52.0 },
      { lat: 46.8139, lng: -71.2082 }  // Quebec City
    ]
  },
  {
    id: 'transatlantic-leroux',
    side: 'jerome',
    era: '17th',
    name: '1668 Filles du Roi Voyage (Paris ➔ Quebec)',
    color: '#38bdf8',
    weight: 2.5,
    path: [
      { lat: 48.8566, lng: 2.3522 },   // Paris
      { lat: 49.9246, lng: 1.0775 },   // Dieppe
      { lat: 49.5, lng: -30.0 },
      { lat: 47.8, lng: -55.0 },
      { lat: 46.8139, lng: -71.2082 }  // Quebec City
    ]
  },
  {
    id: 'groton-march',
    side: 'jerome',
    era: '18th',
    name: '1704 Groton Boy Captive March Route (Groton ➔ Montreal)',
    color: '#f59e0b',
    weight: 2.5,
    path: [
      { lat: 42.6112, lng: -71.5745 }, // Groton, MA
      { lat: 43.6, lng: -72.3 },       // Connecticut River Valley
      { lat: 44.5, lng: -72.5 },       // Lake Champlain Route
      { lat: 45.54, lng: -73.65 }      // Montreal
    ]
  },
  {
    id: 'richelieu-lowell',
    side: 'jerome',
    era: '19th',
    name: '1888 Eno & Lamarre Richelieu Railway Route (Saint-Valentin ➔ Lowell)',
    color: '#38bdf8',
    weight: 3,
    path: [
      { lat: 45.1833, lng: -73.3167 }, // Saint-Valentin, QC
      { lat: 44.4759, lng: -73.2121 }, // Burlington, VT
      { lat: 43.2, lng: -72.4 },       // Concord, NH
      { lat: 42.6425, lng: -71.3162 }  // Lowell, MA
    ]
  },
  {
    id: 'stlawrence-fallriver',
    side: 'jerome',
    era: '19th',
    name: '1888–1890 Michaud & Normand Textile Route (Kamouraska ➔ Fall River)',
    color: '#8b5cf6',
    weight: 3,
    path: [
      { lat: 48.4488, lng: -68.5240 }, // Rimouski, QC
      { lat: 47.5667, lng: -69.8667 }, // Kamouraska
      { lat: 46.8139, lng: -71.2082 }, // Quebec
      { lat: 42.3601, lng: -71.0589 }, // Boston
      { lat: 41.7015, lng: -71.1550 }  // Fall River, MA
    ]
  },
  {
    id: 'acadian-mass',
    side: 'jerome',
    era: '20th',
    name: '1963 Caissie Family Acadian Migration (Saint-Ignace ➔ Massachusetts)',
    color: '#10b981',
    weight: 3,
    path: [
      { lat: 46.7167, lng: -64.9667 }, // Saint-Ignace, NB
      { lat: 45.27, lng: -66.06 },     // Saint John
      { lat: 43.66, lng: -70.25 },     // Portland, ME
      { lat: 42.6425, lng: -71.3162 }  // Lowell, MA
    ]
  },

  // ================= AMY'S MIGRATION CORRIDORS =================
  {
    id: 'spain-colombia',
    side: 'amy',
    era: '17th',
    name: '16th/17th Century Spanish Atlantic Galleon Voyage (Seville ➔ Colombia)',
    color: '#f43f5e',
    weight: 3,
    path: [
      { lat: 40.4168, lng: -3.7038 },   // Madrid/Seville, Spain
      { lat: 36.5298, lng: -6.2924 },   // Cadiz
      { lat: 28.0, lng: -20.0 },        // Canary Islands trade winds
      { lat: 18.0, lng: -50.0 },        // Caribbean crossing
      { lat: 10.3997, lng: -75.5144 },  // Cartagena de Indias
      { lat: 6.5569, lng: -75.8281 },   // Santa Fe de Antioquia
      { lat: 6.2442, lng: -75.5812 }    // Medellín / Rionegro
    ]
  },
  {
    id: 'swiss-america',
    side: 'amy',
    era: '18th',
    name: '18th-Century Swiss Alpine Crossing (Lauenen, Bern ➔ America)',
    color: '#a855f7',
    weight: 2.5,
    path: [
      { lat: 46.4239, lng: 7.3236 },    // Lauenen, Bern, Switzerland
      { lat: 49.0, lng: 8.0 },          // Rhine river valley
      { lat: 51.9, lng: 4.5 },          // Rotterdam port
      { lat: 45.0, lng: -35.0 },        // Atlantic crossing
      { lat: 39.9526, lng: -75.1652 }   // Philadelphia / American Colonies
    ]
  },
  {
    id: 'southern-trail',
    side: 'amy',
    era: '19th',
    name: 'The Great Southern Pioneer Migration (Virginia ➔ Carolinas ➔ TN ➔ Alabama)',
    color: '#fb923c',
    weight: 3,
    path: [
      { lat: 37.5407, lng: -77.4360 },  // Colonial Virginia (Henrico/New Kent)
      { lat: 36.1857, lng: -76.4177 },  // Perquimans, NC
      { lat: 35.9606, lng: -83.9207 },  // Knox County, Tennessee
      { lat: 33.5, lng: -86.8 },        // Central Alabama
      { lat: 31.7088, lng: -87.7778 }   // Grove Hill, Clarke County, AL
    ]
  },
  {
    id: 'swearingen-trail',
    side: 'amy',
    era: '18th',
    name: '1777 Van Swearingen Continental Frontier March (PA ➔ Saratoga)',
    color: '#ec4899',
    weight: 2.5,
    path: [
      { lat: 39.7820, lng: -79.8320 },  // Swearingen\'s Fort, Fayette Co, PA
      { lat: 40.0, lng: -77.5 },        // Pennsylvania Ridge & Valley
      { lat: 41.5, lng: -74.0 },        // Hudson Valley
      { lat: 43.0324, lng: -73.5878 }   // Saratoga Battlefield, NY
    ]
  },

  // ================= THE CONVERGENCE / PAN-AMERICAN UNION =================
  {
    id: 'pan-american-union',
    side: 'both',
    era: '20th',
    name: 'The Eno-Whisenhunt Family Heritage Union',
    color: '#c084fc',
    weight: 3.5,
    path: [
      { lat: 6.2442, lng: -75.5812 },   // Medellín, Colombia
      { lat: 31.7088, lng: -87.7778 },  // Grove Hill, Alabama
      { lat: 42.6425, lng: -71.3162 }   // Lowell & Massachusetts
    ]
  }
];

function getEffectiveMapHubs() {
  if (window.GENEALOGY_DATA && window.GENEALOGY_DATA.mapHubs && window.GENEALOGY_DATA.mapHubs.length > 0) {
    return window.GENEALOGY_DATA.mapHubs;
  }
  return MAP_LOCATIONS;
}

let currentSelectedHub = null;
let timelineCurrentType = 'all';
let timelineSearchQuery = '';
let timelineFilterHubId = null;
let timelinePage = 1;
const TIMELINE_PAGE_SIZE = 40;

function initGoogleMap() {
  const mapElement = document.getElementById('googleMap');
  if (!mapElement) return;

  const darkStyles = [
    { elementType: "geometry", stylers: [{ color: "#171f2d" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#131b26" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#f8fafc" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#223147" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#172334" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b111c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] }
  ];

  googleMapInstance = new google.maps.Map(mapElement, {
    center: { lat: 46.8, lng: -71.2 },
    zoom: 5,
    styles: darkStyles,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false, // We use custom in-map fullscreen button so overlays persist
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM
    }
  });

  const jeromeBounds = new google.maps.LatLngBounds();
  const amyBounds = new google.maps.LatLngBounds();
  mapInitialBounds = new google.maps.LatLngBounds();

  // Clear existing markers
  mapMarkers = [];
  mapPolylines = [];

  // Distinctive Color-Coded Pin Icons
  function getMarkerIcon(loc) {
    let fillColor = '#3b82f6'; // Default Jerome Royal Azure

    if (loc.side === 'both') {
      fillColor = '#a855f7'; // Shared / Union Purple
    } else if (loc.side === 'amy') {
      fillColor = '#f59e0b'; // Amy Warm Amber
      if (loc.category === 'battle') fillColor = '#ef4444';
      else if (loc.category === 'immigration') fillColor = '#f43f5e';
      else if (loc.category === 'cemetery') fillColor = '#9333ea';
    } else {
      // Jerome line
      if (loc.category === 'battle') fillColor = '#ef4444';
      else if (loc.category === 'immigration') fillColor = '#06b6d4';
      else if (loc.category === 'cemetery') fillColor = '#8b5cf6';
    }

    return {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: fillColor,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
      scale: 1.45,
      anchor: new google.maps.Point(12, 22)
    };
  }

  // Add Markers for all hubs
  const effectiveHubs = getEffectiveMapHubs();
  effectiveHubs.forEach(loc => {
    const latLng = new google.maps.LatLng(loc.coords.lat, loc.coords.lng);
    mapInitialBounds.extend(latLng);
    if (loc.side === 'jerome' || loc.side === 'both') {
      jeromeBounds.extend(latLng);
    }
    if (loc.side === 'amy' || loc.side === 'both') {
      amyBounds.extend(latLng);
    }

    const marker = new google.maps.Marker({
      position: latLng,
      map: googleMapInstance,
      title: `${loc.title} (${(loc.people || []).length} relatives)`,
      icon: getMarkerIcon(loc)
    });

    marker.addListener('click', () => {
      showMapLocationCard(loc);
    });

    mapMarkers.push({ marker, category: loc.category, era: loc.era, side: loc.side, loc });
  });

  // Add Migration Polylines
  MAP_ROUTES.forEach(route => {
    const polyline = new google.maps.Polyline({
      path: route.path,
      geodesic: true,
      strokeColor: route.color,
      strokeOpacity: 0.85,
      strokeWeight: route.weight || 2.5,
      map: googleMapInstance
    });

    polyline.addListener('click', () => {
      focusOnMapLocation(route.path[0].lat, route.path[0].lng, route.name, 5);
    });

    mapPolylines.push({ polyline, era: route.era, side: route.side, route });
  });

  applyMapFilters();

  // Default camera bounds to Jerome's line
  if (!jeromeBounds.isEmpty()) {
    googleMapInstance.fitBounds(jeromeBounds);
  } else {
    googleMapInstance.fitBounds(mapInitialBounds);
  }

  // Initialize Master Timeline
  renderMasterTimeline();
}

function showMapLocationCard(loc) {
  currentSelectedHub = loc;
  const card = document.getElementById('mapLocationCard');
  if (!card) return;

  const sideBadge = document.getElementById('mapCardSideBadge');
  const eraBadge = document.getElementById('mapCardEraBadge');
  const catEl = document.getElementById('mapCardCategory');
  const titleEl = document.getElementById('mapCardTitle');
  const regionEl = document.getElementById('mapCardRegion');
  const descEl = document.getElementById('mapCardDesc');
  const ancCountEl = document.getElementById('mapCardAncestorsCount');
  const evtCountEl = document.getElementById('mapCardEventsCount');
  const searchInput = document.getElementById('mapCardSearchInput');

  // Side badge
  const isAmy = loc.side === 'amy';
  const isBoth = loc.side === 'both';
  if (sideBadge) {
    sideBadge.textContent = isBoth ? '👑 Both Lines' : (isAmy ? '🌸 Amy\'s Line' : '⚜️ Jerome\'s Line');
    sideBadge.className = isBoth ? 'tag-pill tag-both' : (isAmy ? 'tag-pill tag-amy' : 'tag-pill tag-jerome');
  }

  // Era badge
  const eraMap = { '16th': '16e Siècle', '17th': '17e Siècle', '18th': '18e Siècle', '19th': '19e Siècle', '20th': '20e Siècle' };
  if (eraBadge) eraBadge.textContent = eraMap[loc.era] || 'All Eras';

  // Category
  if (catEl) catEl.textContent = (loc.category || 'settlement').toUpperCase();

  // Title, Region & Desc
  if (titleEl) titleEl.textContent = loc.title;
  if (regionEl) regionEl.textContent = loc.region || '';
  if (descEl) descEl.textContent = loc.desc;

  if (searchInput) searchInput.value = '';

  // Render Ancestors List
  const ancestors = loc.people || [];
  if (ancCountEl) ancCountEl.textContent = ancestors.length;
  renderCardAncestors(ancestors);

  // Render Local Events List
  const allEvents = (window.GENEALOGY_DATA && window.GENEALOGY_DATA.timelineEvents) || [];
  const localEvents = allEvents.filter(ev => {
    return ev.hid === loc.id || (ev.p && ev.p.some(pid => ancestors.includes(pid)));
  });
  if (evtCountEl) evtCountEl.textContent = localEvents.length;
  renderCardEvents(localEvents);

  // Default to ancestors tab
  switchCardTab('ancestors');

  // Display card
  card.classList.remove('minimized');
  const btnMin = document.getElementById('btnMinimizeCard');
  if (btnMin) btnMin.textContent = '−';
  card.style.display = 'flex';
}

function renderCardAncestors(pids, query = '') {
  const ancEl = document.getElementById('mapCardAncestors');
  if (!ancEl) return;

  const q = query.trim().toLowerCase();
  const filtered = pids.filter(pid => {
    if (!q) return true;
    const p = people[pid];
    if (!p) return false;
    return p.n.toLowerCase().includes(q) || (p.rel && p.rel.toLowerCase().includes(q)) || (p.b && p.b.includes(q)) || (p.d && p.d.includes(q));
  });

  if (filtered.length === 0) {
    ancEl.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); padding:8px 0;">No matching ancestors at this hub.</div>`;
    return;
  }

  ancEl.innerHTML = filtered.map(pid => {
    const p = people[pid];
    const pName = p ? p.n : pid;
    const relStr = p ? getPersonRelationship(p) : '';
    const dateStr = p ? ((p.b ? `b. ${p.b.substring(0,4)}` : '') + (p.d ? ` • d. ${p.d.substring(0,4)}` : '')) : '';
    const sidePill = p && p.s === 'amy' ? '🌸' : '⚜️';
    return `
      <button class="ancestor-link-btn" onclick="openPersonModal('${pid}')" style="display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left;">
        <div>
          <span>${sidePill} ${escapeHtml(pName)}</span>
          ${relStr ? `<div style="font-size:0.68rem; color:var(--accent-gold);">${escapeHtml(relStr)}</div>` : ''}
        </div>
        ${dateStr ? `<span style="font-size:0.68rem; color:var(--text-muted); font-weight:600;">${dateStr}</span>` : ''}
      </button>
    `;
  }).join('');
}

function renderCardEvents(events) {
  const listEl = document.getElementById('mapCardEventsList');
  if (!listEl) return;

  if (events.length === 0) {
    listEl.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); padding:8px 0;">No chronicle events recorded for this hub.</div>`;
    return;
  }

  const iconMap = { battle: '🎖️', migration: '🚢', marriage: '💍', birth: '🌱', death: '⚰️' };
  listEl.innerHTML = events.slice(0, 30).map(ev => {
    const icon = iconMap[ev.t] || '📍';
    return `
      <div class="card-event-item" onclick="flyToTimelineEvent('${ev.id}')">
        <div>
          <span style="font-weight:700; color:#fff;">${icon} ${ev.y}:</span>
          <span style="color:var(--text-secondary); margin-left:4px;">${escapeHtml(ev.title)}</span>
          ${ev.rel ? `<div style="font-size:0.65rem; color:var(--accent-gold); margin-top:2px;">${escapeHtml(ev.rel)}</div>` : ''}
        </div>
        <span style="font-size:0.7rem; color:var(--accent-gold); font-weight:600; flex-shrink:0; margin-left:8px;">📍 View</span>
      </div>
    `;
  }).join('');
}

function handleMapCardSearch() {
  const input = document.getElementById('mapCardSearchInput');
  if (!input || !currentSelectedHub) return;
  renderCardAncestors(currentSelectedHub.people || [], input.value);
}

function switchCardTab(tabName) {
  const tabAnc = document.getElementById('tabCardAncestors');
  const tabEvt = document.getElementById('tabCardEvents');
  const ancList = document.getElementById('mapCardAncestors');
  const evtList = document.getElementById('mapCardEventsList');
  const searchWrap = document.querySelector('.in-map-search-wrap');

  if (tabName === 'ancestors') {
    if (tabAnc) tabAnc.classList.add('active');
    if (tabEvt) tabEvt.classList.remove('active');
    if (ancList) ancList.style.display = 'block';
    if (evtList) evtList.style.display = 'none';
    if (searchWrap) searchWrap.style.display = 'block';
  } else {
    if (tabAnc) tabAnc.classList.remove('active');
    if (tabEvt) tabEvt.classList.add('active');
    if (ancList) ancList.style.display = 'none';
    if (evtList) evtList.style.display = 'flex';
    if (searchWrap) searchWrap.style.display = 'none';
  }
}

function toggleMapCardMinimize() {
  const card = document.getElementById('mapLocationCard');
  const btn = document.getElementById('btnMinimizeCard');
  if (!card) return;
  card.classList.toggle('minimized');
  if (btn) btn.textContent = card.classList.contains('minimized') ? '+' : '−';
}

function closeMapCard() {
  const card = document.getElementById('mapLocationCard');
  if (card) card.style.display = 'none';
  currentSelectedHub = null;
}

function toggleMapLegend() {
  const body = document.getElementById('legendBody');
  const icon = document.getElementById('legendToggleIcon');
  if (!body) return;
  body.classList.toggle('collapsed');
  if (icon) icon.classList.toggle('rotated');
}

function toggleMapFullscreen() {
  const wrapper = document.getElementById('mapContainerWrapper');
  if (!wrapper) return;

  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (wrapper.requestFullscreen) {
        wrapper.requestFullscreen().catch(() => toggleFallbackFullscreen(wrapper));
      } else if (wrapper.webkitRequestFullscreen) {
        wrapper.webkitRequestFullscreen();
      }
      return;
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
  }
  toggleFallbackFullscreen(wrapper);
}

function toggleFallbackFullscreen(wrapper) {
  wrapper.classList.toggle('is-fullscreen');
  const isFs = wrapper.classList.contains('is-fullscreen');
  const btn = document.getElementById('btnMapFullscreen');
  if (btn) btn.textContent = isFs ? '✕ Exit Fullscreen' : '⛶ Fullscreen';
  if (googleMapInstance) {
    setTimeout(() => {
      google.maps.event.trigger(googleMapInstance, 'resize');
    }, 150);
  }
}

document.addEventListener('fullscreenchange', () => {
  const isFs = !!document.fullscreenElement;
  const btn = document.getElementById('btnMapFullscreen');
  if (btn) btn.textContent = isFs ? '✕ Exit Fullscreen' : '⛶ Fullscreen';
  if (googleMapInstance) {
    setTimeout(() => {
      google.maps.event.trigger(googleMapInstance, 'resize');
    }, 150);
  }
});

function resetMapView() {
  if (!googleMapInstance) return;
  const effectiveHubs = getEffectiveMapHubs();
  if (currentMapLine === 'jerome') {
    const jeromeBounds = new google.maps.LatLngBounds();
    effectiveHubs.filter(l => l.side === 'jerome' || l.side === 'both').forEach(l => {
      jeromeBounds.extend(new google.maps.LatLng(l.coords.lat, l.coords.lng));
    });
    googleMapInstance.fitBounds(jeromeBounds);
  } else if (currentMapLine === 'amy') {
    const amyBounds = new google.maps.LatLngBounds();
    effectiveHubs.filter(l => l.side === 'amy' || l.side === 'both').forEach(l => {
      amyBounds.extend(new google.maps.LatLng(l.coords.lat, l.coords.lng));
    });
    googleMapInstance.fitBounds(amyBounds);
  } else if (mapInitialBounds) {
    googleMapInstance.fitBounds(mapInitialBounds);
  }
}

function setMapLine(line, el) {
  currentMapLine = line;
  document.querySelectorAll('#mapLineSelectorBar .line-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');

  applyMapFilters();
  resetMapView();

  // Reset hub filter on line change & refresh master timeline
  timelineFilterHubId = null;
  timelinePage = 1;
  renderMasterTimeline();
}

function setMapEra(era, el) {
  currentMapEra = era;
  document.querySelectorAll('#eraFilterBar .era-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');

  applyMapFilters();

  if (googleMapInstance) {
    if (era === '17th') {
      googleMapInstance.panTo({ lat: 38.0, lng: -45.0 });
      googleMapInstance.setZoom(3.5);
    } else if (era === '18th') {
      googleMapInstance.panTo({ lat: 38.5, lng: -76.0 });
      googleMapInstance.setZoom(5.5);
    } else if (era === '19th') {
      if (currentMapLine === 'amy') {
        googleMapInstance.panTo({ lat: 20.0, lng: -82.0 });
        googleMapInstance.setZoom(4.5);
      } else {
        googleMapInstance.panTo({ lat: 43.8, lng: -72.0 });
        googleMapInstance.setZoom(6.8);
      }
    } else if (era === '20th') {
      googleMapInstance.panTo({ lat: 44.8, lng: -67.5 });
      googleMapInstance.setZoom(5.8);
    } else {
      resetMapView();
    }
  }

  timelinePage = 1;
  renderMasterTimeline();
}

function setMapFilter(cat, el) {
  currentMapCategory = cat;
  document.querySelectorAll('#view-map .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');

  applyMapFilters();
}

function applyMapFilters() {
  mapMarkers.forEach(m => {
    let lineMatch = true;
    if (currentMapLine === 'jerome') {
      lineMatch = (m.side === 'jerome');
    } else if (currentMapLine === 'amy') {
      lineMatch = (m.side === 'amy');
    }

    const eraMatch = (currentMapEra === 'all') || (m.era === currentMapEra);
    const catMatch = (currentMapCategory === 'all') || (m.category === currentMapCategory);

    if (lineMatch && eraMatch && catMatch) {
      m.marker.setMap(googleMapInstance);
    } else {
      m.marker.setMap(null);
    }
  });

  mapPolylines.forEach(p => {
    // Strictly isolate lines: Jerome view never shows Amy routes or the Pan-American Union
    let lineMatch = false;
    if (currentMapLine === 'jerome') {
      lineMatch = (p.side === 'jerome');
    } else if (currentMapLine === 'amy') {
      lineMatch = (p.side === 'amy');
    } else {
      lineMatch = true;
    }

    const eraMatch = (currentMapEra === 'all') || (p.era === currentMapEra);

    if (lineMatch && eraMatch) {
      p.polyline.setMap(googleMapInstance);
    } else {
      p.polyline.setMap(null);
    }
  });
}

// ================= MASTER SYNCHRONIZED EVENT TIMELINE =================
function renderMasterTimeline() {
  const container = document.getElementById('mapTimelineList');
  const countBadge = document.getElementById('timelineCountBadge');
  const titleEl = document.getElementById('timelineHeaderTitle');
  const loadMoreBtn = document.getElementById('loadMoreTimelineBtn');
  if (!container) return;

  const rawEvents = (window.GENEALOGY_DATA && window.GENEALOGY_DATA.timelineEvents) || [];
  
  // Filter events
  let filtered = rawEvents.filter(ev => {
    // 1. Line Filter
    if (currentMapLine === 'jerome' && ev.s === 'amy') return false;
    if (currentMapLine === 'amy' && ev.s === 'jerome') return false;

    // 2. Era Filter
    if (currentMapEra !== 'all' && ev.era !== currentMapEra) return false;

    // 3. Event Type Filter
    if (timelineCurrentType !== 'all' && ev.t !== timelineCurrentType) return false;

    // 4. Hub Filter (if user focused on a specific hub)
    if (timelineFilterHubId && ev.hid !== timelineFilterHubId) return false;

    // 5. Search Query
    if (timelineSearchQuery) {
      const q = timelineSearchQuery.toLowerCase();
      const matchTitle = ev.title && ev.title.toLowerCase().includes(q);
      const matchPn = ev.pn && ev.pn.toLowerCase().includes(q);
      const matchPl = ev.pl && ev.pl.toLowerCase().includes(q);
      const matchYear = String(ev.y).includes(q);
      const matchRel = ev.rel && ev.rel.toLowerCase().includes(q);
      if (!matchTitle && !matchPn && !matchPl && !matchYear && !matchRel) return false;
    }

    return true;
  });

  // Update counts & title
  const totalMatching = filtered.length;
  const visibleLimit = timelinePage * TIMELINE_PAGE_SIZE;
  const visibleEvents = filtered.slice(0, visibleLimit);

  if (countBadge) {
    countBadge.textContent = `${Math.min(visibleLimit, totalMatching).toLocaleString()} of ${totalMatching.toLocaleString()} Events`;
  }

  if (titleEl) {
    const linePrefix = currentMapLine === 'jerome' ? '⚜️ Jerome\'s Line' :
                       currentMapLine === 'amy' ? '🌸 Amy\'s Line' : '👑 Both Family Lines';
    const hubSuffix = timelineFilterHubId ? ` • Hub: ${escapeHtml(currentSelectedHub ? currentSelectedHub.title : timelineFilterHubId)}` : '';
    titleEl.textContent = `${linePrefix} • Historical Master Timeline${hubSuffix}`;
  }

  if (loadMoreBtn) {
    loadMoreBtn.style.display = (visibleLimit < totalMatching) ? 'block' : 'none';
  }

  if (visibleEvents.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:32px 16px; color:var(--text-muted); background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-color);">
        <div style="font-size:1.8rem; margin-bottom:8px;">🔍</div>
        <div style="font-weight:700; color:#fff; margin-bottom:4px;">No Events Found</div>
        <div style="font-size:0.85rem;">No timeline events match the active line, era, or search filters.</div>
        <button class="chip" onclick="resetTimelineFilters()" style="margin-top:12px;">Reset Filters</button>
      </div>
    `;
    return;
  }

  const iconMap = { battle: '🎖️', migration: '🚢', marriage: '💍', birth: '🌱', death: '⚰️' };
  const eraLabelMap = { '16th': '16e Siècle', '17th': '17e Siècle', '18th': '18e Siècle', '19th': '19e Siècle', '20th': '20e Siècle' };

  container.innerHTML = visibleEvents.map(ev => {
    const isAmy = ev.s === 'amy';
    const isBoth = ev.s === 'both';
    const sidePill = isBoth ? '<span class="tag-pill tag-both" style="font-size:0.65rem;">👑 Both Lines</span>' :
                     (isAmy ? '<span class="tag-pill tag-amy" style="font-size:0.65rem;">🌸 Amy\'s Line</span>' :
                              '<span class="tag-pill tag-jerome" style="font-size:0.65rem;">⚜️ Jerome\'s Line</span>');

    const icon = iconMap[ev.t] || '📍';
    const eraLabel = eraLabelMap[ev.era] || 'Historical';
    const hasCoords = ev.coords && ev.coords.length === 2;

    return `
      <div class="timeline-event-card" onclick="flyToTimelineEvent('${ev.id}')">
        <div class="timeline-event-year-badge">
          <div class="timeline-year-num">${ev.y}</div>
          <div class="timeline-event-type-icon">${icon}</div>
        </div>

        <div class="timeline-event-body">
          <div class="timeline-event-meta-row">
            ${sidePill}
            <span class="era-counter-badge" style="font-size:0.65rem;">${eraLabel}</span>
            <span class="story-conflict" style="font-size:0.65rem;">${escapeHtml((ev.t || '').toUpperCase())}</span>
            ${hasCoords ? '<span style="font-size:0.7rem; color:var(--accent-gold); font-weight:700; margin-left:auto;">📍 Map Pin</span>' : ''}
          </div>

          <div class="timeline-event-title">${escapeHtml(ev.title)}</div>
          
          ${ev.rel ? `<div style="font-size:0.72rem; color:var(--accent-gold); font-weight:600; margin-top:2px;">👤 ${escapeHtml(ev.rel)}</div>` : ''}

          <div class="timeline-event-desc">${escapeHtml(ev.desc || '')}</div>

          ${ev.pl ? `
            <div class="timeline-event-place-row">
              <span>📍 ${escapeHtml(ev.pl)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function setTimelineTypeFilter(type, el) {
  timelineCurrentType = type;
  document.querySelectorAll('#mapMasterTimelineWrap .filter-chips-wrap .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  timelinePage = 1;
  renderMasterTimeline();
}

function handleTimelineSearch() {
  const input = document.getElementById('timelineSearchInput');
  timelineSearchQuery = input ? input.value.trim() : '';
  timelinePage = 1;
  renderMasterTimeline();
}

function clearTimelineSearch() {
  const input = document.getElementById('timelineSearchInput');
  if (input) input.value = '';
  timelineSearchQuery = '';
  timelinePage = 1;
  renderMasterTimeline();
}

function loadMoreTimelineEvents() {
  timelinePage++;
  renderMasterTimeline();
}

function resetTimelineFilters() {
  timelineCurrentType = 'all';
  timelineSearchQuery = '';
  timelineFilterHubId = null;
  timelinePage = 1;
  const input = document.getElementById('timelineSearchInput');
  if (input) input.value = '';
  document.querySelectorAll('#mapMasterTimelineWrap .filter-chips-wrap .chip').forEach((c, idx) => {
    if (idx === 0) c.classList.add('active');
    else c.classList.remove('active');
  });
  renderMasterTimeline();
}

function filterTimelineToCurrentHub() {
  if (!currentSelectedHub) return;
  timelineFilterHubId = currentSelectedHub.id;
  timelinePage = 1;
  renderMasterTimeline();
  const timelineEl = document.getElementById('mapMasterTimelineWrap');
  if (timelineEl) {
    timelineEl.scrollIntoView({ behavior: 'smooth' });
  }
}

function flyToTimelineEvent(eventId) {
  const allEvents = (window.GENEALOGY_DATA && window.GENEALOGY_DATA.timelineEvents) || [];
  const ev = allEvents.find(e => e.id === eventId);
  if (!ev) return;

  switchTab('map');

  if (ev.coords && googleMapInstance) {
    google.maps.event.trigger(googleMapInstance, 'resize');
    googleMapInstance.panTo({ lat: ev.coords[0], lng: ev.coords[1] });
    googleMapInstance.setZoom(10);
  }

  // Find matching hub and show in-map card
  const effectiveHubs = getEffectiveMapHubs();
  let matchedHub = null;
  if (ev.hid) {
    matchedHub = effectiveHubs.find(h => h.id === ev.hid);
  }
  if (!matchedHub && ev.coords) {
    matchedHub = effectiveHubs.find(h => 
      Math.abs(h.coords.lat - ev.coords[0]) < 0.15 && Math.abs(h.coords.lng - ev.coords[1]) < 0.15
    );
  }

  if (matchedHub) {
    showMapLocationCard(matchedHub);
  }
}

function focusOnMapLocation(lat, lng, title, zoom = 9) {
  switchTab('map');
  if (googleMapInstance) {
    google.maps.event.trigger(googleMapInstance, 'resize');
    googleMapInstance.panTo({ lat, lng });
    googleMapInstance.setZoom(zoom);
  }

  const effectiveHubs = getEffectiveMapHubs();
  const matched = effectiveHubs.find(l => 
    Math.abs(l.coords.lat - lat) < 0.12 && Math.abs(l.coords.lng - lng) < 0.12
  );

  if (matched) {
    showMapLocationCard(matched);
  }
}


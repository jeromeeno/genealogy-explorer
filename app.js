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
    if (mapInitialBounds) googleMapInstance.fitBounds(mapInitialBounds);
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

// ================= GOOGLE MAPS PLATFORM =================
let googleMapInstance = null;
let mapMarkers = [];
let mapInitialBounds = null;

const MAP_LOCATIONS = [
  {
    id: 'lowell',
    title: 'Lowell, Massachusetts',
    category: 'immigration',
    coords: { lat: 42.6425, lng: -71.3162 },
    desc: 'The historic Franco-American industrial heartland. Destination for William & Pierre Eno (~1888), Alexis & Albina Lamarre (~1886), Joseph Henri L\'Heureux (1875), and Napoleon Phaneuf (~1872).',
    people: ['GHYM-322', '9NF5-87T', 'LB2Q-2LK', '9NF5-871', 'GLRP-DPJ', 'K266-GQ5', 'K2TL-BCX', '9VNH-9FG']
  },
  {
    id: 'fallriver',
    title: 'Fall River, Massachusetts',
    category: 'cemetery',
    coords: { lat: 41.7015, lng: -71.1550 },
    desc: 'Textile mill community in Ward 2 and site of Notre Dame Cemetery, where 3rd great-grandparents Augustin Normand (1896) and Emélie Hudon (1907) are interred. Joseph Michaud died here in 1921.',
    people: ['LYGW-92H', 'LYGW-92X', '99H8-3PS', 'LZKF-68P', 'L7D1-LT4', 'L5PJ-F8K']
  },
  {
    id: 'groton',
    title: 'Groton, Massachusetts',
    category: 'battle',
    coords: { lat: 42.6112, lng: -71.5745 },
    desc: 'Scene of the Queen Anne\'s War raid on August 8, 1704. 14-year-old Matthias Farnsworth was captured in the fields and marched 300 miles to Montreal, founding the Phaneuf dynasty.',
    people: ['LKK6-RYV']
  },
  {
    id: 'saint-valentin',
    title: 'Saint-Valentin, Quebec',
    category: 'immigration',
    coords: { lat: 45.1833, lng: -73.3167 },
    desc: 'Rural Richelieu River farming parish. Birthplace of Pierre Eno (1882) and home of William Eno. Site of the tragic 1884 death of Josephine Poirier that prompted the family\'s move to Lowell.',
    people: ['LB2Q-2LK', '9NF5-87T', 'GV5P-3RH', 'LDHZ-S4B']
  },
  {
    id: 'berthier',
    title: 'Berthierville & Sorel, Quebec',
    category: 'battle',
    coords: { lat: 46.0667, lng: -73.1833 },
    desc: 'Original frontier land concession granted to Carignan-Salières soldier Jacques Énaud dit Canada in 1665 to guard against Iroquois war parties on the Richelieu River.',
    people: ['GM4N-59X', 'LTC5-FPN', 'GFD9-BK2', 'G7PZ-WRB', 'LCXY-QZ1']
  },
  {
    id: 'riviere-ouelle',
    title: 'Rivière-Ouelle, Quebec',
    category: 'battle',
    coords: { lat: 47.4333, lng: -70.0167 },
    desc: 'Site of the October 1690 shoreline ambush during King William\'s War. Jean Pelletier and Guillaume Lizotte were among the 39 settlers who repelled Sir William Phips\' English armada.',
    people: ['LZ8C-GTL', 'LYF3-4HN']
  },
  {
    id: 'castine',
    title: 'Pentagouet (Castine), Maine',
    category: 'battle',
    coords: { lat: 44.3881, lng: -68.7997 },
    desc: 'Wilderness post founded by Jean-Vincent d\'Abbadie, 3e Baron de Saint-Castin, who married Pidianské, daughter of Grand Sagamore Madockawando.',
    people: ['9KDS-BKX', 'L4SP-V3B']
  },
  {
    id: 'pemaquid',
    title: 'Fort William Henry (Pemaquid), Maine',
    category: 'battle',
    coords: { lat: 43.8797, lng: -69.5250 },
    desc: 'English stone fortress besieged and destroyed in 1696 by Baron de Saint-Castin and Pierre Le Moyne d\'Iberville with Abenaki war parties in canoes.',
    people: ['9KDS-BKX']
  },
  {
    id: 'cap-rouge',
    title: 'Cap-Rouge, Quebec',
    category: 'battle',
    coords: { lat: 46.7500, lng: -71.3500 },
    desc: 'Site of the June 10, 1653 Iroquois ambush where Pierre LePicard-Gareman was martyred while defending his 10-year-old son Charles.',
    people: ['LRCC-3XL']
  },
  {
    id: 'saint-ignace',
    title: 'Saint-Ignace, Kent Co., New Brunswick',
    category: 'immigration',
    coords: { lat: 46.7167, lng: -64.9667 },
    desc: 'The 300-year Acadian homeland of the Caissie and Gallant families, who stayed in the Maritimes until Diane Caissie and Eugene immigrated to Massachusetts in 1963.',
    people: ['PW92-7TK', 'G3ZY-8HH', 'PW92-ZRG', 'P9GJ-VQK', 'GDQD-SQH']
  },
  {
    id: 'swearingen-fort',
    title: 'Swearingen\'s Fort (Fayette County, PA)',
    category: 'battle',
    coords: { lat: 39.7820, lng: -79.8320 },
    desc: 'Pioneer stockade in Springhill Township built on a 468-acre tract, home to Captain Van Swearingen ("Indian Van") on the Ohio Valley frontier.',
    people: ['LB67-R2J']
  },
  {
    id: 'yorktown',
    title: 'Yorktown, Virginia',
    category: 'battle',
    coords: { lat: 37.2388, lng: -76.5097 },
    desc: 'October 1781 Siege of Yorktown. Captain Antoine Paulin served with Hazen\'s 2nd Canadian Regiment under George Washington when General Cornwallis surrendered.',
    people: ['L4WD-WP8']
  },
  {
    id: 'saratoga',
    title: 'Saratoga Battlefield, New York',
    category: 'battle',
    coords: { lat: 43.0324, lng: -73.5878 },
    desc: '1777 Saratoga Campaign. Captain Van Swearingen fought under Daniel Morgan\'s elite rifle corps before being captured and questioned by General Fraser.',
    people: ['LB67-R2J']
  }
];

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
    center: { lat: 43.8, lng: -72.0 },
    zoom: 6,
    styles: darkStyles,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true
  });

  mapInitialBounds = new google.maps.LatLngBounds();

  // Pin Icons
  const icons = {
    battle: {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: "#f59e0b",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
      scale: 1.4,
      anchor: new google.maps.Point(12, 22)
    },
    immigration: {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: "#10b981",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
      scale: 1.4,
      anchor: new google.maps.Point(12, 22)
    },
    cemetery: {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: "#8b5cf6",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
      scale: 1.4,
      anchor: new google.maps.Point(12, 22)
    }
  };

  // Add Markers
  MAP_LOCATIONS.forEach(loc => {
    const latLng = new google.maps.LatLng(loc.coords.lat, loc.coords.lng);
    mapInitialBounds.extend(latLng);

    const marker = new google.maps.Marker({
      position: latLng,
      map: googleMapInstance,
      title: loc.title,
      icon: icons[loc.category] || icons.immigration
    });

    marker.addListener('click', () => {
      showMapLocationCard(loc);
    });

    mapMarkers.push({ marker, category: loc.category });
  });

  // Add Historical Migration Polylines
  // 1. 1704 Groton to Montreal Captive March Route
  new google.maps.Polyline({
    path: [
      { lat: 42.6112, lng: -71.5745 }, // Groton
      { lat: 43.6, lng: -72.3 },       // Connecticut River Valley
      { lat: 44.5, lng: -72.5 },       // Lake Champlain Route
      { lat: 45.54, lng: -73.65 }      // Montreal / Sault-au-Récollet
    ],
    geodesic: true,
    strokeColor: '#f59e0b',
    strokeOpacity: 0.7,
    strokeWeight: 2,
    map: googleMapInstance
  });

  // 2. ~1888 Eno Richelieu Railway Route to Lowell
  new google.maps.Polyline({
    path: [
      { lat: 45.1833, lng: -73.3167 }, // Saint-Valentin
      { lat: 44.4759, lng: -73.2121 }, // Burlington
      { lat: 42.6425, lng: -71.3162 }  // Lowell
    ],
    geodesic: true,
    strokeColor: '#38bdf8',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    map: googleMapInstance
  });

  // 3. 1963 Acadian Migration to Massachusetts
  new google.maps.Polyline({
    path: [
      { lat: 46.7167, lng: -64.9667 }, // Saint-Ignace, NB
      { lat: 45.3, lng: -66.0 },       // Saint John
      { lat: 43.66, lng: -70.25 },     // Portland, ME
      { lat: 42.6425, lng: -71.3162 }  // Massachusetts
    ],
    geodesic: true,
    strokeColor: '#10b981',
    strokeOpacity: 0.8,
    strokeWeight: 2.5,
    map: googleMapInstance
  });

  googleMapInstance.fitBounds(mapInitialBounds);
}

function showMapLocationCard(loc) {
  const card = document.getElementById('mapLocationCard');
  const catEl = document.getElementById('mapCardCategory');
  const titleEl = document.getElementById('mapCardTitle');
  const descEl = document.getElementById('mapCardDesc');
  const ancEl = document.getElementById('mapCardAncestors');

  catEl.textContent = loc.category.toUpperCase();
  titleEl.textContent = loc.title;
  descEl.textContent = loc.desc;

  ancEl.innerHTML = (loc.people || []).map(pid => {
    const p = people[pid];
    const pName = p ? p.n : pid;
    return `<button class="ancestor-link-btn" onclick="openPersonModal('${pid}')">👤 ${escapeHtml(pName)}</button>`;
  }).join('');

  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeMapCard() {
  document.getElementById('mapLocationCard').style.display = 'none';
}

function setMapFilter(cat, el) {
  document.querySelectorAll('#view-map .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');

  mapMarkers.forEach(m => {
    if (cat === 'all' || m.category === cat) {
      m.marker.setMap(googleMapInstance);
    } else {
      m.marker.setMap(null);
    }
  });
}


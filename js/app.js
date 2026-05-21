/**
 * app.js — Main controller for Wind Farm Lifecycle Explorer.
 * Manages state, tab switching, and coordinates all sub-modules.
 */
const AppState = {
  plants: [],
  filteredPlants: [],
  selectedPlant: null,
  activeTab: 'map',
  awDataLoaded: false,
  awTable: null,
  draftTable: null,
  filterChips: {
    operating: true,
    repower: true,
    expansion: true,
    has_retire: true,
    retired: true,
  },
};

async function init() {
  // Show loading
  document.getElementById('loading-overlay')?.classList.add('visible');

  try {
    // Load main plant index
    const resp = await fetch('data/plants_index.json');
    AppState.plants = await resp.json();
    AppState.filteredPlants = [...AppState.plants];

    // Load stats
    try {
      const statsResp = await fetch('data/stats.json');
      const stats = await statsResp.json();
      renderStats(stats);
    } catch (e) { /* stats optional */ }

    // Initialize map
    initMap(AppState.plants);

    // Initialize search
    initSearch();

    // Initialize tabs
    initTabs();

    // Initialize filter chips
    initFilterChips();

    // Update sidebar list
    updateSidebarList(AppState.plants);

    // Hide loading
    document.getElementById('loading-overlay')?.classList.remove('visible');
  } catch (err) {
    console.error('Init error:', err);
    document.getElementById('loading-overlay')?.classList.remove('visible');
  }
}

function renderStats(stats) {
  const bar = document.getElementById('stats-bar');
  if (!bar) return;
  bar.innerHTML = `
    <span class="stat-item"><span class="stat-value">${stats.total_plants}</span> plants</span>
    <span class="stat-item"><span class="stat-value">${stats.total_capacity_gw}</span> GW</span>
    <span class="stat-item"><span class="stat-value">${stats.num_states}</span> states</span>
    <span class="stat-item"><span class="stat-value">${stats.with_repower || 0}</span> repowered</span>
    <span class="stat-item"><span class="stat-value">${stats.with_expansion || 0}</span> expanded</span>
    <span class="stat-item"><span class="stat-value">${stats.with_retire || 0}</span> retired</span>
  `;
}

// --- Tab Switching ---
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === AppState.activeTab) return;

      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update panels
      tabPanels.forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');

      AppState.activeTab = tab;

      // Lazy load table data
      if (tab === 'table' && !AppState.awDataLoaded) {
        initTableTabs();
        AppState.awDataLoaded = true;
      }
      // When leaving table tab, hide column selector
      if (tab !== 'table') {
        document.getElementById('col-selector-btn').style.display = 'none';
        document.getElementById('col-selector-dropdown').style.display = 'none';
      }

      // Invalidate map size
      if (tab === 'map') {
        setTimeout(() => window.map && window.map.invalidateSize(), 100);
      }
    });
  });
}

// --- Filter Chips ---
function initFilterChips() {
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      AppState.filterChips[filter] = !AppState.filterChips[filter];
      chip.classList.toggle('active', AppState.filterChips[filter]);
      applyFilters();
    });
  });
  updateFilterCounts();
}

function updateFilterCounts() {
  let op = 0, rp = 0, ex = 0, hr = 0, rt = 0;
  AppState.plants.forEach(p => {
    if (p.status === 'OP') op++;
    if (p.has_repower) rp++;
    if (p.has_expansion) ex++;
    if (p.has_retire && p.status === 'OP') hr++;
    if (p.status === 'RE' || p.status === 'OA') rt++;
  });
  document.getElementById('count-operating').textContent = op;
  document.getElementById('count-repower').textContent = rp;
  document.getElementById('count-expansion').textContent = ex;
  document.getElementById('count-hasretire').textContent = hr;
  document.getElementById('count-retired').textContent = rt;
}

function applyFilters() {
  const { operating, repower, expansion, has_retire, retired } = AppState.filterChips;

  if (!operating && !repower && !expansion && !has_retire && !retired) {
    AppState.filteredPlants = [];
    updateSidebarList([]);
    updateMapMarkers([]);
    return;
  }

  AppState.filteredPlants = AppState.plants.filter(p => {
    // OR logic: plant passes if it matches ANY selected chip
    const isOperating = p.status === 'OP';
    const isRepowered = p.has_repower;
    const isExpanded = p.has_expansion;
    const isPartialRetire = p.has_retire && p.status === 'OP';
    const isRetired = p.status === 'RE' || p.status === 'OA';

    if (operating && isOperating) return true;
    if (repower && isRepowered) return true;
    if (expansion && isExpanded) return true;
    if (has_retire && isPartialRetire) return true;
    if (retired && isRetired) return true;
    return false;
  });

  updateSidebarList(AppState.filteredPlants);
  updateMapMarkers(AppState.filteredPlants);
}

// --- Sidebar Plant List ---
function updateSidebarList(plants) {
  const list = document.getElementById('plant-list');
  list.innerHTML = '';

  const visible = plants.slice(0, 100); // Limit sidebar to 100 for performance

  visible.forEach(plant => {
    const card = document.createElement('div');
    card.className = 'plant-card';
    card.innerHTML = `
      <div class="pc-header">
        <span class="pc-code">#${plant.plant_code}</span>
        <span class="status-badge ${getStatusClass(plant.status)}">${getStatusLabel(plant.status)}</span>
      </div>
      <div class="pc-name">${escHtml(plant.plant_name)}</div>
      <div class="pc-meta">
        <span>${plant.state}, ${plant.county}</span>
        <span>${fmtCapacity(plant.current_nameplate_mw)}</span>
        <span>since ${fmtDate(plant.first_operation_date)}</span>
      </div>
      <div class="pc-flags">
        ${plant.has_repower ? '<span class="flag flag-repower">REPOWER</span>' : ''}
        ${plant.has_expansion ? '<span class="flag flag-expansion">EXPANSION</span>' : ''}
        ${plant.has_retire ? '<span class="flag flag-retire">RETIRE</span>' : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      AppState.selectedPlant = plant;
      document.querySelectorAll('.plant-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      flyToPlant(plant, true);
    });

    list.appendChild(card);
  });

  if (plants.length > 100) {
    const more = document.createElement('div');
    more.style.cssText = 'text-align:center;padding:8px;font-size:12px;color:#7f8c8d;';
    more.textContent = `+ ${plants.length - 100} more plants (zoom in or search to narrow)`;
    list.appendChild(more);
  }

  document.getElementById('sidebar-count').textContent = `${plants.length} plants`;
}

// --- Draft Full-Page View ---
async function openDraftPanel(plant) {
  document.getElementById('header').style.display = 'none';
  document.getElementById('tab-bar').style.display = 'none';
  document.getElementById('tab-content').style.display = 'none';

  const fullpage = document.getElementById('draft-fullpage');
  fullpage.classList.add('active');
  document.getElementById('draft-fullpage-title').textContent =
    `#${plant.plant_code} ${plant.plant_name} — Draft Sheet`;
  document.getElementById('draft-fullpage-loading').style.display = 'flex';
  document.getElementById('draft-fullpage-table').innerHTML = '';

  try {
    const resp = await fetch(`data/drafts/${plant.plant_code}.json`);
    const draftData = await resp.json();
    if (!draftData.rows || draftData.rows.length === 0) {
      document.getElementById('draft-fullpage-table').innerHTML =
        '<p style="padding:24px;color:#7f8c8d;text-align:center;">No draft data available for this plant.</p>';
    } else {
      renderDraftTable(document.getElementById('draft-fullpage-table'), draftData);
    }
  } catch (err) {
    document.getElementById('draft-fullpage-table').innerHTML =
      `<p style="padding:24px;color:#e74c3c;text-align:center;">Error: ${err.message}</p>`;
  }
  document.getElementById('draft-fullpage-loading').style.display = 'none';
}

function closeDraftPanel() {
  document.getElementById('draft-fullpage').classList.remove('active');
  document.getElementById('draft-fullpage-table').innerHTML = '';
  document.getElementById('header').style.display = '';
  document.getElementById('tab-bar').style.display = '';
  document.getElementById('tab-content').style.display = '';
  if (AppState.draftTable) { try { AppState.draftTable.destroy(); } catch(e) {} AppState.draftTable = null; }
  setTimeout(() => window.map && window.map.invalidateSize(), 100);
}

document.getElementById('draft-back-btn').addEventListener('click', closeDraftPanel);

// --- Global: expose for cross-module access ---
window.AppState = AppState;
window.openDraftPanel = openDraftPanel;
window.openDraftByCode = (pc) => {
  const plant = AppState.plants.find(p => p.plant_code === pc);
  if (plant) openDraftPanel(plant);
};
window.closeDraftPanel = closeDraftPanel;
window.updateSidebarList = updateSidebarList;
window.applyFilters = applyFilters;

// --- Start ---
document.addEventListener('DOMContentLoaded', init);

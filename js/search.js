/**
 * search.js — Search bar with dropdown results.
 */

function initSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const resultsDiv = document.getElementById('search-results');

  const doSearch = debounce((query) => {
    if (!query || query.trim().length < 1) {
      resultsDiv.classList.remove('visible');
      clearBtn.classList.remove('visible');
      return;
    }

    clearBtn.classList.add('visible');

    const q = query.trim().toLowerCase();

    // Check for exact plant code match
    const codeMatch = parseInt(q);
    let results;

    if (!isNaN(codeMatch)) {
      // Exact code match first, then partial name match
      const exact = AppState.plants.filter(p => p.plant_code === codeMatch);
      const nameMatches = AppState.plants.filter(p =>
        p.plant_code !== codeMatch && p.plant_name.toLowerCase().includes(q)
      );
      results = [...exact, ...nameMatches].slice(0, 12);
    } else {
      results = AppState.plants.filter(p =>
        p.plant_name.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.county.toLowerCase().includes(q)
      ).slice(0, 12);
    }

    renderResults(results);
  }, 250);

  input.addEventListener('input', () => doSearch(input.value));
  input.addEventListener('focus', () => {
    if (input.value.trim()) doSearch(input.value);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    resultsDiv.classList.remove('visible');
    clearBtn.classList.remove('visible');
    AppState.filteredPlants = [...AppState.plants];
    updateSidebarList(AppState.plants);
    updateMapMarkers(AppState.plants);
  });

  // Close results on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-container')) {
      resultsDiv.classList.remove('visible');
    }
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      resultsDiv.classList.remove('visible');
      input.blur();
    }
  });
}

function renderResults(results) {
  const div = document.getElementById('search-results');

  if (results.length === 0) {
    div.innerHTML = '<div class="search-result-item" style="color:#7f8c8d;">No plants found</div>';
    div.classList.add('visible');
    return;
  }

  div.innerHTML = results.map(p => `
    <div class="search-result-item" data-pc="${p.plant_code}">
      <div class="sr-name">${escHtml(p.plant_name)} <span class="pc-code">#${p.plant_code}</span></div>
      <div class="sr-meta">${p.state}, ${p.county} · ${fmtCapacity(p.current_nameplate_mw)} · since ${fmtDate(p.first_operation_date)}</div>
    </div>
  `).join('');

  // Click handlers
  div.querySelectorAll('.search-result-item[data-pc]').forEach(el => {
    el.addEventListener('click', () => {
      const pc = parseInt(el.dataset.pc);
      const plant = AppState.plants.find(p => p.plant_code === pc);
      if (plant) {
        AppState.selectedPlant = plant;
        flyToPlant(plant, true);
        updateSidebarList([plant]);
        document.getElementById('search-results').classList.remove('visible');
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear').classList.remove('visible');
      }
    });
  });

  div.classList.add('visible');
}

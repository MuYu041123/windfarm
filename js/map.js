/**
 * map.js — Leaflet map with pin markers, clustering, popups.
 */

let map;
let markerClusterGroup;
let allMarkers = [];
const markerMap = new Map();

function initMap(plants) {
  map = L.map('map-container', {
    center: [39.8, -98.5],
    zoom: 5,
    minZoom: 4,
    maxZoom: 18,
    zoomSnap: 0.25,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
    maxNativeZoom: 18,
  }).addTo(map);

  markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 14,
    chunkedLoading: true,
    iconCreateFunction: clusterIcon,
  });

  allMarkers = plants.map(plant => createMarker(plant));
  markerClusterGroup.addLayers(allMarkers);
  map.addLayer(markerClusterGroup);

  createLegend();

  window.map = map;
  window.markerMap = markerMap;
  window.flyToPlant = flyToPlant;
  window.updateMapMarkers = updateMapMarkers;
}

function pinSvg(color) {
  return `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.268 21.732 0 14 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="14" cy="12" r="5" fill="#fff" opacity="0.9"/>
  </svg>`;
}

function getColorHex(color) {
  switch (color) {
    case 'green': return '#27ae60';
    case 'blue': return '#2980b9';
    case 'orange': return '#e67e22';
    case 'red': return '#e74c3c';
    case 'purple': return '#8e44ad';
    case 'gray': return '#95a5a6';
    default: return '#27ae60';
  }
}

function createMarker(plant) {
  const hex = getColorHex(plant.marker_color);
  const icon = L.divIcon({
    html: pinSvg(hex),
    className: 'custom-pin',
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -38],
  });

  const marker = L.marker([plant.latitude, plant.longitude], { icon });

  marker.bindPopup(() => buildPopup(plant), {
    maxWidth: 350,
    className: 'plant-popup-container',
  });

  marker.on('click', () => {
    window.AppState.selectedPlant = plant;
    highlightSidebarCard(plant.plant_code);
  });

  marker.plant_code = plant.plant_code;
  marker._plant = plant;
  markerMap.set(plant.plant_code, marker);

  return marker;
}

function clusterIcon(cluster) {
  const count = cluster.getChildCount();
  let size = 'small';
  if (count >= 50) size = 'large';
  else if (count >= 15) size = 'medium';

  return L.divIcon({
    html: `<div><span>${count}</span></div>`,
    className: `marker-cluster marker-cluster-${size}`,
    iconSize: L.point(40, 40),
  });
}

function buildPopup(plant) {
  const events = [];
  if (plant.has_repower) events.push(`<span class="flag flag-repower">Repower: ${escHtml(plant.repower_years || 'Yes')}</span>`);
  if (plant.has_expansion) events.push(`<span class="flag flag-expansion">Expansion: ${escHtml(plant.expansion_years || 'Yes')}</span>`);
  if (plant.has_retire) events.push(`<span class="flag flag-retire">Retirement: ${escHtml(plant.retire_years || 'Yes')}</span>`);

  const sourceUrl = plant.primary_url || plant.alt_url || '';
  const sourceLabel = plant.primary_url ? 'Source Link' : (plant.alt_url ? 'Alt Source' : '');

  return `
    <div class="plant-popup">
      <div class="popup-header">
        <span class="pc-badge">#${plant.plant_code}</span>
        <h3>${escHtml(plant.plant_name)}</h3>
      </div>
      <div class="popup-body">
        <div class="popup-row"><label>State/County:</label> ${escHtml(plant.state)}, ${escHtml(plant.county)}</div>
        <div class="popup-row"><label>First Op:</label> ${fmtDate(plant.first_operation_date)}</div>
        <div class="popup-row"><label>Capacity:</label> ${fmtCapacity(plant.current_nameplate_mw)}</div>
        <div class="popup-row"><label>Status:</label> <span class="status-badge ${getStatusClass(plant.status)}">${getStatusLabel(plant.status)}</span></div>
        ${plant.utility_name ? `<div class="popup-row"><label>Utility:</label> ${escHtml(plant.utility_name)}</div>` : ''}
        <div class="popup-flags">${events.join('')}</div>
        ${sourceUrl ? `<a href="${escHtml(sourceUrl)}" target="_blank" class="btn-alt-url">${sourceLabel} →</a>` : ''}
      </div>
      <div class="popup-footer">
        <button class="btn-details" onclick="window.openDraftByCode(${plant.plant_code})">View Draft Sheet</button>
      </div>
    </div>
  `;
}

function flyToPlant(plant, openPopup) {
  map.flyTo([plant.latitude, plant.longitude], Math.max(map.getZoom(), 13), { duration: 0.8 });
  setTimeout(() => {
    const marker = markerMap.get(plant.plant_code);
    if (marker && openPopup) {
      if (!marker.isPopupOpen()) marker.openPopup();
    }
  }, 900);
}

function updateMapMarkers(plants) {
  const pcodes = new Set(plants.map(p => p.plant_code));
  allMarkers.forEach(marker => {
    if (pcodes.has(marker.plant_code)) {
      if (!map.hasLayer(marker)) markerClusterGroup.addLayer(marker);
    } else {
      markerClusterGroup.removeLayer(marker);
    }
  });
}

function highlightSidebarCard(plantCode) {
  document.querySelectorAll('.plant-card').forEach(card => card.classList.remove('selected'));
  document.querySelectorAll('.plant-card .pc-code').forEach(el => {
    if (el.textContent === `#${plantCode}`) {
      el.closest('.plant-card').classList.add('selected');
    }
  });
}

function createLegend() {
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', '');
    div.id = 'map-legend';
    div.innerHTML = `
      <div class="legend-item"><span class="legend-dot" style="background:#27ae60"></span> Operating</div>
      <div class="legend-item"><span class="legend-dot" style="background:#2980b9"></span> Repowered</div>
      <div class="legend-item"><span class="legend-dot" style="background:#e67e22"></span> Expanded</div>
      <div class="legend-item"><span class="legend-dot" style="background:#e74c3c"></span> Has Retirement</div>
      <div class="legend-item"><span class="legend-dot" style="background:#95a5a6"></span> Retired / Inactive</div>
    `;
    return div;
  };
  legend.addTo(map);
}

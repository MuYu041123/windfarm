/**
 * draft-viewer.js — Renders draft sheet inline, following the EXACT same
 * pattern as table.js which works correctly.
 */

function renderDraftTable(container, draftData) {
  const { headers, rows } = draftData;

  if (!rows || rows.length === 0) {
    container.innerHTML = '<p style="padding:16px;color:#7f8c8d;">No draft data available for this plant.</p>';
    return;
  }

  // Build columns — EXACT same format as table.js: {title, field, width}
  const columns = headers.map((h, i) => ({
    title: String(h),
    field: `c${i}`,
    width: Math.max(100, Math.min(300, String(h).length * 9 + 20)),
  }));

  // Build data — EXACT same format: keys match column fields
  const data = rows.map(row => {
    const r = {};
    headers.forEach((h, i) => {
      const v = row[h];
      r[`c${i}`] = v !== undefined && v !== null ? v : null;
    });
    return r;
  });

  // Destroy old table
  if (window.AppState && window.AppState.draftTable) {
    try { window.AppState.draftTable.destroy(); } catch(e) {}
  }

  // Clear container
  container.innerHTML = '';

  // Create Tabulator — EXACT same config as table.js
  const table = new Tabulator(container, {
    data: data,
    columns: columns,
    layout: 'fitDataFill',
    height: '100%',
    movableColumns: true,
    selectable: false,
    placeholder: 'No data',
  });

  if (window.AppState) window.AppState.draftTable = table;
}

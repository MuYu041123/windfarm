/**
 * table.js — Multi-table viewer for Summary, Lifecycle, and AllWindPlant.
 * Uses Tabulator with header filters: multi-select checkboxes for categorical,
 * numeric range inputs for numbers, and text search for strings.
 */

const TableManager = {
  tables: {},       // {tablename: Tabulator instance}
  loaded: {},       // {tablename: bool}
  columns: {},      // {tablename: column definitions}
  currentTable: 'summary',
};

const TABLE_CONFIGS = {
  summary: {
    colsUrl: 'data/summary_columns.json',
    dataUrl: 'data/summary_data.json',
    label: 'Summary',
  },
  lifecycle: {
    colsUrl: 'data/lifecycle_columns.json',
    dataUrl: 'data/lifecycle_data.json',
    label: 'Lifecycle',
  },
  allwindplant: {
    colsUrl: 'data/allwindplant_columns.json',
    dataUrl: 'data/allwindplant_data.json',
    label: 'AllWindPlant',
  },
};

async function initTableTabs() {
  // Default to showing Summary table
  await switchTable('summary');
}

async function switchTable(tableName) {
  const config = TABLE_CONFIGS[tableName];
  if (!config) return;

  TableManager.currentTable = tableName;

  // Update sub-tab buttons
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.table === tableName);
  });

  // Show/hide containers
  document.querySelectorAll('.table-panel').forEach(panel => {
    panel.style.display = panel.id === `table-${tableName}` ? 'flex' : 'none';
  });

  // Load data if not already loaded
  if (!TableManager.loaded[tableName]) {
    await loadTable(tableName, config);
    TableManager.loaded[tableName] = true;
  }

  // Show Columns button only for AllWindPlant
  const btn = document.getElementById('col-selector-btn');
  const dd = document.getElementById('col-selector-dropdown');
  if (tableName === 'allwindplant') {
    btn.style.display = 'inline-block';
    const table = TableManager.tables[tableName];
    const cols = TableManager.columns[tableName];
    if (table && cols) buildColumnSelector(tableName, cols, table);
  } else {
    btn.style.display = 'none';
    dd.style.display = 'none';
  }
}

async function loadTable(tableName, config) {
  const container = document.getElementById(`table-${tableName}`);
  const loading = document.getElementById(`loading-${tableName}`);
  const tableDiv = document.getElementById(`tabulator-${tableName}`);

  loading.style.display = 'flex';
  tableDiv.innerHTML = '';

  try {
    const [colsResp, dataResp] = await Promise.all([
      fetch(config.colsUrl),
      fetch(config.dataUrl),
    ]);

    const columns = await colsResp.json();
    const data = await dataResp.json();

    // Build Tabulator columns with proper filter configs
    const tabCols = columns.map((col, i) => {
      const c = {
        title: col.title,
        field: col.field,
        frozen: col.frozen === true,
        headerFilter: true,
        width: col.width || 120,
        sorter: col.dtype === 'number' ? 'number' : 'string',
      };

      // Header filter — white input box on every column
      c.headerFilterLiveFilterDelay = 400;
      if (col.headerFilter === 'number') {
        c.headerFilter = 'number';
      } else {
        c.headerFilter = 'input';
      }

      // Number formatter
      if (col.dtype === 'number') {
        c.horizontalAlign = 'right';
        c.formatter = function (cell) {
          const v = cell.getValue();
          if (v == null || v === '') return '';
          const n = Number(v);
          if (isNaN(n)) return v;
          if (Math.abs(n) >= 1000000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
          if (n % 1 !== 0) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
          return n.toLocaleString('en-US');
        };
      }

      // URL formatter
      if (col.title && (col.title.toLowerCase().includes('url') || col.field.toLowerCase().includes('url'))) {
        c.formatter = function (cell) {
          const v = cell.getValue();
          if (!v) return '';
          return `<a href="${v}" target="_blank" style="color:#2980b9;">Link</a>`;
        };
      }

      return c;
    });

    // Create Tabulator
    const table = new Tabulator(tableDiv, {
      data: data,
      columns: tabCols,
      layout: 'fitDataFill',
      height: '100%',
      pagination: true,
      paginationSize: 50,
      paginationSizeSelector: [25, 50, 100, 250],
      paginationCounter: 'rows',
      movableColumns: true,
      selectable: false,
      initialSort: [{ column: tabCols[0]?.field, dir: 'asc' }],
      renderHorizontal: 'virtual',
      headerVisible: true,
      columnDefaults: {
        headerSort: true,
        resizable: true,
        headerMenu: true,
      },
      placeholder: 'No data',
    });

    // Show column count and note about hidden columns
    const visibleCount = tabCols.filter(c => c.visible !== false).length;
    document.getElementById(`count-${tableName}`).textContent =
      `${data.length.toLocaleString('en-US')} rows × ${columns.length} cols (${visibleCount} visible, use column picker to show more)`;

    TableManager.tables[tableName] = table;
    TableManager.columns[tableName] = tabCols;
    loading.style.display = 'none';

    // Build column selector dropdown
    buildColumnSelector(tableName, tabCols, table);

    // Show row count
    document.getElementById(`count-${tableName}`).textContent = `${data.length.toLocaleString('en-US')} rows`;
  } catch (err) {
    loading.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
    console.error(`Error loading ${tableName}:`, err);
  }
}

// Sub-tab click handlers
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTable(btn.dataset.table);
    });
  });
});

function buildColumnSelector(tableName, columns, table) {
  const btn = document.getElementById('col-selector-btn');
  const dropdown = document.getElementById('col-selector-dropdown');

  btn.style.display = 'inline-block';
  btn.onclick = (e) => {
    e.stopPropagation();
    // Rebuild dropdown from current column visibility state each time it opens
    const currentCols = table.getColumns();
    const html = columns.map((col, i) => {
      const colComp = currentCols.find(c => c.getField() === col.field);
      const isVisible = colComp ? colComp.isVisible() : (col.visible !== false);
      const checked = isVisible ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;white-space:nowrap;">
        <input type="checkbox" class="col-cb" ${checked} onchange="window.toggleColumn('${tableName}','${col.field}', this.checked)">
        <span>${col.title.substring(0, 60)}</span>
      </label>`;
    }).join('');
    const selectAll = `<label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;font-weight:700;border-bottom:1px solid #eee;margin-bottom:4px;cursor:pointer;">
      <input type="checkbox" checked onchange="var cbs=document.querySelectorAll('#col-selector-dropdown input.col-cb');for(var i=0;i<cbs.length;i++){cbs[i].checked=this.checked;window.toggleColumn('${tableName}',cbs[i].getAttribute('data-field'),this.checked)}">
      <span>Select All / None</span>
    </label>`;
    dropdown.innerHTML = selectAll + html;

    const rect = btn.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  };

  document.addEventListener('click', () => { dropdown.style.display = 'none'; });
  dropdown.addEventListener('click', (e) => { e.stopPropagation(); });
}

window.toggleColumn = function(tableName, field, show) {
  const table = TableManager.tables[tableName];
  if (table) {
    if (show) {
      table.showColumn(field);
    } else {
      table.hideColumn(field);
    }
  }
};

// Expose
window.TableManager = TableManager;
window.switchTable = switchTable;
window.initTableTabs = initTableTabs;
window.buildColumnSelector = buildColumnSelector;

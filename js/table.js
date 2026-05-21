/**
 * table.js — Multi-table viewer for Summary, Lifecycle, and AllWindPlant.
 * Uses Tabulator with header filters: multi-select checkboxes for categorical,
 * numeric range inputs for numbers, and text search for strings.
 */

const TableManager = {
  tables: {},       // {tablename: Tabulator instance}
  loaded: {},       // {tablename: bool}
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

      // Ensure every column has a filter
      c.headerFilterLiveFilterDelay = 400;
      if (col.headerFilter === 'select' || (col.nunique && col.nunique <= 50 && col.dtype === 'string')) {
        c.headerFilter = 'select';
        c.headerFilterParams = { values: true, multiselect: true, clearable: true };
      } else if (col.dtype === 'number') {
        c.headerFilter = 'number';
      } else {
        c.headerFilter = 'input';
      }

      // Performance: only show first 30 columns by default for wide tables
      if (columns.length > 50 && i >= 30) {
        c.visible = false;
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
      columnDefaults: {
        headerSort: true,
        resizable: true,
      },
      placeholder: 'No data',
    });

    // Show column count and note about hidden columns
    const visibleCount = tabCols.filter(c => c.visible !== false).length;
    document.getElementById(`count-${tableName}`).textContent =
      `${data.length.toLocaleString('en-US')} rows × ${columns.length} cols (${visibleCount} visible, use column picker to show more)`;

    TableManager.tables[tableName] = table;
    loading.style.display = 'none';

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

// Expose
window.TableManager = TableManager;
window.switchTable = switchTable;
window.initTableTabs = initTableTabs;

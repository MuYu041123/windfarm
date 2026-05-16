/**
 * Shared utility functions for the Wind Farm Lifecycle Explorer.
 */

/** Format a number with commas (e.g. 1234567 → "1,234,567") */
function fmtNum(n) {
  if (n == null || isNaN(n)) return '';
  return Number(n).toLocaleString('en-US');
}

/** Format MW value (e.g. 150.5 → "150.5 MW") */
function fmtMW(n) {
  if (n == null || isNaN(n)) return '';
  return Number(n).toFixed(1) + ' MW';
}

/** Format a capacity value smartly (if < 1 MW, show kW) */
function fmtCapacity(n) {
  if (n == null || isNaN(n)) return '';
  if (n < 1) return (n * 1000).toFixed(0) + ' kW';
  return Number(n).toFixed(1) + ' MW';
}

/** Format date string (e.g. "2011-10" or "2011") */
function fmtDate(d) {
  if (!d || d === 'nan') return '';
  const parts = String(d).split('-');
  if (parts.length === 2) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = parseInt(parts[1]) - 1;
    return m >= 0 && m < 12 ? `${months[m]} ${parts[0]}` : d;
  }
  return String(d);
}

/** Escape HTML entities */
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Debounce function */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Get marker color for a plant */
function getMarkerColor(plant) {
  return plant.marker_color || 'green';
}

/** Get status badge CSS class */
function getStatusClass(status) {
  switch (status) {
    case 'OP': return 'status-op';
    case 'RE': return 'status-re';
    case 'OS': return 'status-os';
    case 'OA': return 'status-oa';
    case 'CN': return 'status-cn';
    default: return 'status-default';
  }
}

/** Get status label */
function getStatusLabel(status) {
  switch (status) {
    case 'OP': return 'Operating';
    case 'RE': return 'Retired';
    case 'OS': return 'Out of Service';
    case 'OA': return 'Abandoned';
    case 'CN': return 'Canceled';
    default: return status || 'Unknown';
  }
}

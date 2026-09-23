// ==UserScript==
// @name         GSheet – filtr Cashback (Deal Type)
// @namespace    kimrioter
// @version      1.0.0
// @description  Filtruje wiersze arkusza (view only) po kolumnie B "Deal Type" – pokazuje tylko cashback w osobnym panelu
// @author       kimrioter
// @match        https://docs.google.com/spreadsheets/d/1imrMx7Yj60T8UEuFPzriVF4WgopUWhpFpVp0pKt0WJM/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @connect      docs.google.com
// @connect      googleusercontent.com
// @connect      doc-0s-sheets.googleusercontent.com
// @run-at       document-idle
// @updateURL    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/main/gsheet-cashback-filter.user.js
// @downloadURL  https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/main/gsheet-cashback-filter.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ===== KONFIGURACJA =====
  const FILTER_COL_INDEX = 1;          // kolumna B (0 = A, 1 = B, ...)
  const FILTER_HEADER = 'deal type';   // nagłówek, po którym szukamy wiersza nagłówków
  const DEFAULT_KEYWORD = 'cashback';  // fraza filtra (bez rozróżniania wielkości liter)
  const BRAND = '#750000';
  const LOG = '[TM script by kimrioter]';

  const SHEET_ID = location.pathname.split('/d/')[1].split('/')[0];

  // Uwaga: Google Sheets wymusza Trusted Types – NIE używamy innerHTML, tylko createElement/textContent
  const el = (tag, props = {}, children = []) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    children.forEach(c => c && n.appendChild(c));
    return n;
  };

  GM_addStyle(`
    #tmcb-btn{position:fixed;bottom:24px;right:24px;z-index:99999;background:${BRAND};color:#fff;border:none;
      border-radius:22px;padding:10px 18px;font:600 13px Arial,sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.3)}
    #tmcb-btn:hover{filter:brightness(1.2)}
    #tmcb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100000;display:flex;align-items:center;justify-content:center}
    #tmcb-panel{background:#fff;width:94vw;height:88vh;border-radius:10px;display:flex;flex-direction:column;
      font:13px Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4);overflow:hidden}
    #tmcb-head{background:${BRAND};color:#fff;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    #tmcb-head b{font-size:15px;margin-right:auto}
    #tmcb-head input{padding:5px 8px;border-radius:4px;border:none;min-width:160px}
    #tmcb-head button{background:#fff;color:${BRAND};border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-weight:600}
    #tmcb-status{padding:6px 14px;background:#f6eaea;color:#333;border-bottom:1px solid #ddd}
    #tmcb-wrap{flex:1;overflow:auto}
    #tmcb-table{border-collapse:collapse;min-width:100%}
    #tmcb-table th{position:sticky;top:0;background:#eee;text-align:left;border:1px solid #ccc;padding:5px 7px;white-space:nowrap}
    #tmcb-table td{border:1px solid #ddd;padding:4px 7px;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}
    #tmcb-table tr:nth-child(even) td{background:#fafafa}
    #tmcb-table tr:hover td{background:#fbeaea}
    #tmcb-table td.tmcb-deal{font-weight:600;color:${BRAND}}
  `);

  // ===== PARSER CSV (obsługa cudzysłowów, przecinków i nowych linii w komórkach) =====
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function getGid() {
    const m = (location.hash + location.search).match(/gid=(\d+)/);
    return m ? m[1] : '0';
  }

  // ===== POBIERANIE DANYCH =====
  // 1) export CSV przez GM_xmlhttpRequest (pełne dane), 2) fallback: gviz (same-origin)
  function fetchExport(gid) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
        onload: r => (r.status === 200 && !/^\s*<!DOCTYPE|<html/i.test(r.responseText))
          ? resolve(r.responseText) : reject(new Error('export HTTP ' + r.status)),
        onerror: () => reject(new Error('export network error')),
      });
    });
  }

  async function fetchGviz(gid) {
    const r = await fetch(`/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`, { credentials: 'include' });
    if (!r.ok) throw new Error('gviz HTTP ' + r.status);
    return r.text();
  }

  async function loadRows() {
    const gid = getGid();
    try {
      return { rows: parseCSV(await fetchExport(gid)), src: 'export' };
    } catch (e) {
      console.warn(LOG, 'Export nie zadziałał, próbuję gviz:', e.message);
      return { rows: parseCSV(await fetchGviz(gid)), src: 'gviz' };
    }
  }

  // ===== PANEL =====
  let state = { header: [], data: [], filtered: [] };

  function findHeaderIdx(rows) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      if ((rows[i][FILTER_COL_INDEX] || '').trim().toLowerCase() === FILTER_HEADER) return i;
    }
    return 0;
  }

  function applyFilter() {
    const kw = document.getElementById('tmcb-kw').value.trim().toLowerCase();
    const search = document.getElementById('tmcb-search').value.trim().toLowerCase();
    state.filtered = state.data.filter(r => {
      const deal = (r.cells[FILTER_COL_INDEX] || '').toLowerCase();
      if (kw && !deal.includes(kw)) return false;
      if (search && !r.cells.some(c => c.toLowerCase().includes(search))) return false;
      return true;
    });
    renderTable();
  }

  function renderTable() {
    const table = document.getElementById('tmcb-table');
    table.replaceChildren();
    const thead = el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Wiersz' }),
      ...state.header.map(h => el('th', { text: h })),
    ])]);
    const tbody = el('tbody');
    state.filtered.forEach(r => {
      tbody.appendChild(el('tr', {}, [
        el('td', { text: String(r.rowNo) }),
        ...state.header.map((_, i) => el('td', {
          text: r.cells[i] || '',
          title: r.cells[i] || '',
          class: i === FILTER_COL_INDEX ? 'tmcb-deal' : '',
        })),
      ]));
    });
    table.append(thead, tbody);
    document.getElementById('tmcb-status').textContent =
      `Wyników: ${state.filtered.length} z ${state.data.length} wierszy (arkusz gid=${getGid()})`;
  }

  function toTSV() {
    return [state.header, ...state.filtered.map(r => r.cells)]
      .map(r => r.map(c => (c || '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
  }

  function downloadCSV() {
    const esc = c => /[",\n]/.test(c || '') ? `"${(c || '').replace(/"/g, '""')}"` : (c || '');
    const csv = [state.header, ...state.filtered.map(r => r.cells)].map(r => r.map(esc).join(',')).join('\n');
    const a = el('a', {
      href: URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })),
      download: `cashback_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function refresh() {
    const status = document.getElementById('tmcb-status');
    status.textContent = 'Ładowanie danych…';
    try {
      const { rows, src } = await loadRows();
      const hIdx = findHeaderIdx(rows);
      state.header = rows[hIdx] || [];
      state.data = rows.slice(hIdx + 1)
        .map((cells, i) => ({ cells, rowNo: hIdx + 2 + i }))
        .filter(r => r.cells.some(c => c.trim() !== ''));
      console.log(LOG, `Załadowano ${state.data.length} wierszy (źródło: ${src})`);
      applyFilter();
    } catch (e) {
      console.error(LOG, e);
      status.textContent = '❌ Nie udało się pobrać danych – możliwe, że właściciel zablokował pobieranie/kopiowanie dla przeglądających. (' + e.message + ')';
    }
  }

  function openPanel() {
    if (document.getElementById('tmcb-overlay')) return;
    const close = () => overlay.remove();
    const overlay = el('div', { id: 'tmcb-overlay', onclick: e => { if (e.target === overlay) close(); } }, [
      el('div', { id: 'tmcb-panel' }, [
        el('div', { id: 'tmcb-head' }, [
          el('b', { text: '💸 Filtr: Deal Type' }),
          el('input', { id: 'tmcb-kw', value: DEFAULT_KEYWORD, placeholder: 'Deal Type zawiera…', oninput: applyFilter }),
          el('input', { id: 'tmcb-search', placeholder: 'Szukaj w wynikach…', oninput: applyFilter }),
          el('button', { text: '⟳ Odśwież', onclick: refresh }),
          el('button', { text: '📋 Kopiuj', onclick: () => { GM_setClipboard(toTSV()); alert('Skopiowano – wklej do Excela/Sheets'); } }),
          el('button', { text: '⬇ CSV', onclick: downloadCSV }),
          el('button', { text: '✕', onclick: close }),
        ]),
        el('div', { id: 'tmcb-status', text: '' }),
        el('div', { id: 'tmcb-wrap' }, [el('table', { id: 'tmcb-table' })]),
      ]),
    ]);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    refresh();
  }

  document.body.appendChild(el('button', { id: 'tmcb-btn', text: '💸 Cashback', onclick: openPanel }));
  console.log(LOG, 'Filtr cashback gotowy');
})();

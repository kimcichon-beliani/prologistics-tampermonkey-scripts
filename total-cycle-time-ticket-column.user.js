// ==UserScript==
// @name         Total Cycle Time – partner filter + ticket column
// @namespace    kimrioter
// @version      2.4.0
// @description  total_cycle_time.php: panel szybkiego wyboru partnera (Seller + Source Seller), kolumna Ticket (✔️), podsumowanie Orders / Orders from tickets pod wykresem, przyciski dat (Yesterday, Last Weekend + Mon) i kolumna Checked?
// @author       kimrioter
// @match        https://www.prologistics.info/total_cycle_time.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/total-cycle-time-ticket-column.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/total-cycle-time-ticket-column.user.js
// ==/UserScript==

// Dwa niezależne moduły w jednym pliku (każdy we własnym IIFE, więc stałe LOG/BRAND się nie zderzają):
//   1) Partner filter  – panel po prawej, wypełnia Seller i Source Seller
//   2) Ticket column   – kolumna Ticket, podsumowanie pod wykresem, przycisk Yesterday

// ═══════════════════════════ 1) PARTNER FILTER ═══════════════════════════
(function () {
  'use strict';

  const LOG = '[TM script by kimrioter]';
  const BRAND = '#750000';
  const PANEL_ID = 'tm-partner-filter-v2'; // nowe id – stare wersje używały 'tm-partner-filter'

  // ───────────────────────────────────────────────────────────────
  // PARTNER -> nazwy w liście "Source Seller" (dokładny tekst opcji).
  // Seller (górna lista) jest wyliczany automatycznie z klasy opcji Source Seller
  // (np. Allegro CZ ma class="Beliani CZ" -> zaznaczy się "CZ: Beliani CZ = ...").
  // ───────────────────────────────────────────────────────────────
  const PARTNERS = {
    'Allegro Brand PL': ['Allegro Brand'],
    'Allegro CZ': ['Allegro CZ'],
    'Allegro HU': ['Allegro HU'],
    'Allegro PL': ['Allegro'],
    'Allegro SK': ['Allegro SK'],
    'Altex RO': ['Altex RO'],
    'Amazon + Prime DE': ['Amazon DE', 'Amazon Prime DE'],
    'Amazon + Prime ES': ['Amazon ES', 'Amazon Prime ES'],
    'Amazon + Prime FR': ['Amazon FR', 'Amazon Prime FR'],
    'Amazon IT': ['Amazon IT'],
    'Amazon NL': ['Amazon NL'],
    'Amazon PL': ['Amazon PL'],
    'Amazon SE': ['Amazon SE'],
    'Amazon Seller Flex DE': ['Amazon DE Seller Flex'],
    'Amazon UK': ['Amazon UK'],
    'B&Q UK': ['B&Q', 'B&Q 0 VAT'],
    'Bauhaus DE': ['Bauhaus DE'],
    'Black Red White PL': ['Black Red White'],
    'Bloop PT': ['Bloop PT'],
    'Bol.com NL': ['Bol.com NL'],
    'Brico BE': ['Brico BE'],
    'Brico Bravo IT': ['Brico Bravo IT'],
    'Brico Depot ES': ['Brico Depot ES'],
    'Brico Depot PT': ['Brico Depot PT'],
    'Bricomarché FR': ['Bricomarche FR'],
    'BUT FR': ['BUT'],
    'Carrefour ES': ['Carrefour ES'],
    'Carrefour FR': ['Carrefour FR'],
    'Castorama FR': ['Castorama FR'],
    'Castorama PL': ['Castorama PL'],
    'Cdiscount FR': ['CDiscount FR'],
    'Check24 DE': ['Check24'],
    'Conforama ES': ['Conforama ES'],
    'Conforama FR': ['Conforama'],
    'Conforama PT': ['CONFORAMA_PRT'],
    'Cultura FR': ['Cultura FR'],
    'E-price IT': ['ePrice IT'],
    'eBay DE': ['eBay DE'],
    'eBay FR': ['Ebay FR'],
    'eBay IT': ['eBay IT'],
    'eBay UK': ['eBay UK'],
    'eMAG HU': ['EMAG HU', 'EMAG HU COD'],
    'eMAG RO': ['eMAG RO'],
    'Empik PL': ['Empik'],
    'Furniture1 HU': ['Furniture1 HU'],
    'Furniture1 LT': ['Furniture1'],
    'Galaxus CH': ['Galaxus (Beliani) CH'],
    'Gamm Vert FR': ['Gamm vert FR'],
    'Hobbybox DK': ['Hobbybox DK'],
    'Hobbybox FI': ['Hobbybox FI'],
    'Hobbybox SE': ['Hobbybox SE'],
    'Home&You PL': ['Home&You'],
    'Home24 AT': ['Home24 AT'],
    'Home24 CH': ['Home24 CH'],
    'Home24 DE': ['Home24 DE'],
    'Home24 FR': ['Home24 FR'],
    'Home24 NL': ['Home24 NL'],
    'Homedeco NL': ['Homedeco NL'],
    'Hornbach DE': ['Hornbach DE'],
    'Joybuy DE': ['Joybuy DE'],
    'Kaufland AT': ['Kaufland AT'],
    'Kaufland CZ': ['Kaufland CZ'],
    'Kaufland DE': ['Kaufland DE'],
    'Kaufland PL': ['Kaufland PL'],
    'Kaufland SK': ['Kaufland SK'],
    'Kuanto Kusta PT': ['KuantoKusta PT'],
    'Leen Bakker BE': ['Leen Bakker BE'],
    'Leen Bakker NL': ['Leen Bakker NL'],
    'Leroy Merlin ES': ['LEROYMERLIN_ESP'],
    'Leroy Merlin FR': ['LEROYMERLIN'],
    'Leroy Merlin IT': ['Leroy Merlin IT'],
    'Leroy Merlin PT': ['Leroy Merlin PT'],
    'Leroy Merlin RO': ['Leroy Merlin RO'],
    'Limango DE': ['Limango DE'],
    'Maisons du Monde DE': ['MAISONDUMONDE_DEU'],
    'Maisons du Monde ES': ['Maisons du Monde ES'],
    'Maisons du Monde FR': ['MAISONDUMONDE'],
    'Maisons du Monde IT': ['Maisons du Monde IT'],
    'ManoMano DE': ['Manomano (DE)'],
    'ManoMano ES': ['Mano Mano ES / MonEchelle'],
    'ManoMano FR': ['Mano Mano FR'],
    'ManoMano IT': ['ManoMano IT'],
    'ManoMano UK': ['Manomano (UK)'],
    'Manor CH': ['MANOR'],
    'MediaMarkt Saturn CH': ['MediaMarkt Saturn CH'],
    'Mömax AT': ['Mömax AT'],
    'Mömax DE': ['Mömax DE'],
    'Morele PL': ['Morele'],
    'OBI CH': ['OBI CH'],
    'OBI DE': ['OBI DE'],
    'OnBuy UK': ['OnBuy'],
    'PayBack DE': ['Payback DE'],
    'Praxis NL': ['Praxis NL'],
    'Robert Dyas UK': ['Robert Dyas'],
    'Shein DE': ['Shein DE'],
    'Shopping AT': ['Shöpping AT'],
    'Temu CH': ['TEMU CH'],
    'Trademax Dropship SE': ['Trademax SE'],
    'Trademax OnDemand SE': ['Trademax SE'],
    'Vente Unique AT': ['Vente Unique Austria'],
    'Vente Unique BE': ['Vente Unique Belgium'],
    'Vente Unique CH': ['Vente Unique CH'],
    'Vente Unique DE': ['VENTEUNIQUE_DEU'],
    'Vente Unique ES': ['Vente-Unique ES'],
    'Vente Unique FR': ['Vente Unique'],
    'Vente Unique IT': ['Vente Unique IT'],
    'Vente Unique LU': ['Vente Unique Luxembourg'],
    'Vente Unique NL': ['Vente-Unique NL'],
    'Vente Unique PL': ['Vente Unique PL'],
    'Vente Unique PT': ['Vente-Unique PT'],
    'Vente Unique SE': ['Vente Unique SE'],
    'Vente Unique UK': ['Vente Unique UK', 'Vente Unique UK 0% VAT'],
    'Vivre HU': ['Vivre HU'],
    'Vivre RO': ['Vivre RO'],
    'Wayfair UK': ['Wayfair UK from DE (0%)'],
    'Wolf DE': ['Supply 24 (Wolf)'],
    'Worten PT': ['Worten Marketplace'],
    'XXXLutz AT': ['XXXLutz AT'],
    'XXXLutz CH': ['XXXLutz CH'],
    'XXXLutz CZ': ['XXXLutz CZ'],
    'XXXLutz DE': ['XXXLutz'],
    'XXXLutz HR': ['XXXLutz HR'],
    'XXXLutz RO': ['XXXLutz RO'],
    'XXXLutz SE': ['XXXLutz SE'],
    'XXXLutz SI': ['XXXLutz SI'],
  };

  // Wyjątki: partner, który wysyłamy spod innego sellera niż wynika z klasy Source Sellera
  // (wartość `value` z listy Seller). Wayfair UK wysyłamy spod sellera DE.
  const SELLER_OVERRIDE = {
    'Wayfair UK': 'Beliani DE',
  };

  // Sellerzy, z których NIE korzystamy (wartości `value` z listy Seller) – zostaną pominięci
  const BLOCKED_SELLERS = [
    'BCE',
    'Beliani (International) GmbH',
    'Beliani DE alternative',
    'Beliani SP Alternative Seller',
    'Beliani PL Alternative',
    'Beliani PL Alternative Liquida',
  ];

  // ───────────────────────────────────────────────────────────────
  // Pomocnicze
  // ───────────────────────────────────────────────────────────────
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function fireChange(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true })); // odpala też inline onchange="chooseSourceSeller()"
  }

  function deselectAll(select) {
    Array.from(select.options).forEach((o) => { o.selected = false; });
  }

  function applyPartner(partner, setStatus) {
    const sellerSel = document.getElementById('seller');
    const sourceSel = document.getElementById('source_seller');
    if (!sellerSel || !sourceSel) return setStatus('✖ Seller / Source Seller lists not found');

    const wantedNames = (PARTNERS[partner] || []).map(norm);
    const sourceOpts = Array.from(sourceSel.options).filter((o) => wantedNames.includes(norm(o.textContent)));
    if (!sourceOpts.length) return setStatus(`✖ "${partner}" not found in the Source Seller list`);

    // Seller wyliczony z klasy opcji Source Seller
    const skipped = [];
    const okSourceOpts = [];
    const sellerValues = new Set();
    sourceOpts.forEach((o) => {
      const cls = SELLER_OVERRIDE[partner] || (o.className || '').trim();
      const sellerOpt = Array.from(sellerSel.options).find((s) => s.value === cls);
      if (!cls || !sellerOpt) { skipped.push(`${o.textContent.trim()} (no seller)`); return; }
      if (BLOCKED_SELLERS.includes(cls)) { skipped.push(`${o.textContent.trim()} (seller ${cls} skipped)`); return; }
      sellerValues.add(cls);
      okSourceOpts.push(o);
    });

    if (!okSourceOpts.length) return setStatus('✖ none of the sellers is allowed:\n' + skipped.join('\n'));

    // 1) Seller – odpala chooseSourceSeller(), które przefiltruje Source Seller
    deselectAll(sellerSel);
    Array.from(sellerSel.options).forEach((s) => { if (sellerValues.has(s.value)) s.selected = true; });
    fireChange(sellerSel);

    // 2) Source Seller – po chwili, żeby nie nadpisało tego filtrowanie listy
    setTimeout(() => {
      deselectAll(sourceSel);
      okSourceOpts.forEach((o) => { o.selected = true; });
      fireChange(sourceSel);
      console.log(LOG, 'filtr', { partner, sellers: [...sellerValues], source: okSourceOpts.map((o) => o.textContent.trim()) });
    }, 150);

    const lines = [
      '✔ seller: ' + Array.from(sellerValues).join(', '),
      '✔ source seller: ' + okSourceOpts.map((o) => o.textContent.trim()).join(', '),
    ];
    if (skipped.length) lines.push('⚠ skipped: ' + skipped.join('; '));
    setStatus(lines.join('\n'));
  }

  function clearAll(setStatus) {
    const sellerSel = document.getElementById('seller');
    const sourceSel = document.getElementById('source_seller');
    [sellerSel, sourceSel].forEach((sel) => {
      if (!sel) return;
      deselectAll(sel);
      if (sel.options[0]) sel.options[0].selected = true; // "All"
    });
    if (sellerSel) fireChange(sellerSel);
    setStatus('Cleared (All)');
  }

  // ───────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────
  function buildPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const box = document.createElement('div');
    box.id = PANEL_ID;
    box.style.cssText = [
      'position:fixed', 'top:85px', 'right:12px', 'z-index:99999', 'width:270px',
      'background:#fff', `border:2px solid ${BRAND}`, 'border-radius:6px',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)', 'font:13px Arial,sans-serif', 'padding:8px',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Partner filter';
    title.style.cssText = `font-weight:bold;color:${BRAND};margin-bottom:6px;cursor:move`;

    const body = document.createElement('div');

    // Wyszukiwarka tylko przewija listę do dopasowania – niczego nie ukrywa
    const search = document.createElement('input');
    search.placeholder = 'Jump to partner...';
    search.style.cssText = 'width:100%;box-sizing:border-box;padding:4px;margin-bottom:6px';

    // Lista wszystkich partnerów – zawsze w całości, przewijana
    const list = document.createElement('div');
    list.style.cssText = 'max-height:240px;overflow-y:auto;border:1px solid #ccc;border-radius:4px;margin-bottom:6px';

    const items = {};
    let selected = null;
    const setStatus = (t) => { status.textContent = t; };

    // Zapamiętany stan listy (przeżywa przeładowanie strony po Search): wybrany partner + pozycja przewinięcia
    const STATE_KEY = 'tm_partner_panel_state';
    const saveState = () => {
      try { localStorage.setItem(STATE_KEY, JSON.stringify({ selected, scrollTop: list.scrollTop })); } catch (err) { /* ignore */ }
    };
    let scrollTimer = null;
    list.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(saveState, 150);
    });

    const highlight = (name) => {
      if (selected && items[selected]) {
        items[selected].style.background = '';
        items[selected].style.color = '';
      }
      selected = name;
      if (name && items[name]) {
        items[name].style.background = BRAND;
        items[name].style.color = '#fff';
      }
    };

    Object.keys(PARTNERS).forEach((name) => {
      const row = document.createElement('div');
      row.textContent = name;
      row.style.cssText = 'padding:3px 6px;cursor:pointer';
      row.addEventListener('mouseenter', () => { if (name !== selected) row.style.background = '#f0e0e0'; });
      row.addEventListener('mouseleave', () => { if (name !== selected) row.style.background = ''; });
      row.addEventListener('click', () => {
        highlight(name);
        saveState();
        applyPartner(name, setStatus);
      });
      items[name] = row;
      list.appendChild(row);
    });

    search.addEventListener('input', () => {
      const q = norm(search.value);
      if (!q) return;
      const hit = Object.keys(items).find((n) => norm(n).startsWith(q)) || Object.keys(items).find((n) => norm(n).includes(q));
      if (hit) items[hit].scrollIntoView({ block: 'nearest' });
    });

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear (All)';
    clear.style.cssText = `background:${BRAND};color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer`;
    clear.addEventListener('click', () => { highlight(null); search.value = ''; saveState(); clearAll(setStatus); });

    // Przycisk Search = kopia przycisku "Filter" ze strony (klika oryginał, więc wysyła się name="filter")
    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.textContent = 'Search';
    searchBtn.style.cssText = `background:${BRAND};color:#fff;border:0;border-radius:4px;padding:4px 14px;cursor:pointer;font-weight:bold`;
    searchBtn.addEventListener('click', () => {
      const filterBtn = document.querySelector('input[type="submit"][name="filter"]');
      if (!filterBtn) return setStatus('✖ "Filter" button not found on the page');
      saveState(); // zapamiętaj wybranego partnera i miejsce na liście przed przeładowaniem strony
      filterBtn.click();
    });

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:6px';
    buttons.append(searchBtn, clear);

    // Zakres dat – tylko podgląd (nieedytowalny), przepisywany z pól #from i #to
    const range = document.createElement('div');
    range.style.cssText = `margin-top:8px;padding:4px 6px;background:#f5f5f5;border-radius:4px;color:${BRAND};font-weight:bold`;
    const renderRange = () => {
      const from = document.getElementById('from');
      const to = document.getElementById('to');
      const txt = `Date range: ${from ? from.value : '?'} → ${to ? to.value : '?'}`;
      if (range.textContent !== txt) range.textContent = txt;
    };
    renderRange();
    ['from', 'to'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', renderRange);
      el.addEventListener('change', renderRange);
    });
    setInterval(renderRange, 500); // datepicker ustawia wartość bez zdarzeń

    const status = document.createElement('pre');
    status.style.cssText = 'margin:8px 0 0;white-space:pre-wrap;font:12px Arial,sans-serif';

    // ── przeciąganie panelu za tytuł; klik bez ruchu nadal zwija / rozwija ──
    const POS_KEY = 'tm_partner_panel_pos';
    const setPos = (left, top) => {
      const l = Math.min(Math.max(0, left), Math.max(0, window.innerWidth - box.offsetWidth));
      const t = Math.min(Math.max(0, top), Math.max(0, window.innerHeight - 30));
      box.style.left = l + 'px';
      box.style.top = t + 'px';
      box.style.right = 'auto';
    };
    title.style.cursor = 'move';
    title.style.userSelect = 'none';
    title.style.touchAction = 'none';
    let drag = null;
    title.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = box.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false };
      title.setPointerCapture(e.pointerId);
    });
    title.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
      drag.moved = true;
      setPos(e.clientX - drag.dx, e.clientY - drag.dy);
    });
    title.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      try { title.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (d.moved) {
        try { localStorage.setItem(POS_KEY, JSON.stringify({ left: parseFloat(box.style.left), top: parseFloat(box.style.top) })); } catch (err) { /* ignore */ }
      } else {
        body.style.display = body.style.display === 'none' ? '' : 'none';
      }
    });
    title.addEventListener('pointercancel', () => { drag = null; });
    window.addEventListener('resize', () => {
      if (box.style.left) setPos(parseFloat(box.style.left), parseFloat(box.style.top));
    });

    body.append(search, list, buttons, range, status);
    box.append(title, body);
    document.body.appendChild(box);

    // przywróć zapamiętaną pozycję panelu
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (saved && isFinite(saved.left) && isFinite(saved.top)) setPos(saved.left, saved.top);
    } catch (err) { /* ignore */ }

    // przywróć wybranego partnera (podświetlenie) i pozycję na liście
    try {
      const st = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      if (st) {
        if (st.selected && items[st.selected]) {
          highlight(st.selected);
          setStatus('Last selected: ' + st.selected);
        }
        list.scrollTop = Number(st.scrollTop) || 0;
        // jeśli układ strony jeszcze się ustawia, ponów po chwili
        setTimeout(() => { list.scrollTop = Number(st.scrollTop) || 0; }, 300);
      }
    } catch (err) { /* ignore */ }
  }

  // Usuwa panel ze starych wersji / zdublowanego skryptu (stare id), żeby nie zasłaniał nowego
  function removeLegacyPanels() {
    document.querySelectorAll('#tm-partner-filter').forEach((el) => el.remove());
  }

  removeLegacyPanels();
  buildPanel();
  setTimeout(removeLegacyPanels, 1000);
  setTimeout(removeLegacyPanels, 3000);
  console.log(LOG, 'total-cycle-time-partner-filter v1.6.0 loaded');
})();

// ═══════════════════════════ 2) TICKET COLUMN ═══════════════════════════
(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const MARKER_TEXT = 'Generated from Ticket#';
    const CACHE_PREFIX = 'tm_ticket_check_';
    const MAX_PARALLEL = 5;
    const BRAND = '#750000';

    // ---------- cache (status "z ticketu" nie zmienia się po utworzeniu zamówienia) ----------
    function cacheGet(key) {
        try {
            const v = localStorage.getItem(CACHE_PREFIX + key);
            return v ? JSON.parse(v) : null;
        } catch (e) { return null; }
    }
    function cacheSet(key, val) {
        try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    }

    // ---------- sprawdzenie pojedynczego zamówienia ----------
    async function checkOrder(number, txnid) {
        const key = number + '_' + txnid;
        const cached = cacheGet(key);
        if (cached) return cached;

        const url = `/auction.php?number=${number}&txnid=${txnid}`;
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();

        const result = { ticket: false, rmaId: null };
        if (html.includes(MARKER_TEXT)) {
            result.ticket = true;
            const m = html.match(/Generated from Ticket#\s*<a[^>]*rma_id=(\d+)/i);
            if (m) result.rmaId = m[1];
        }
        cacheSet(key, result);
        return result;
    }

    // ---------- kolejka z limitem równoległych zapytań ----------
    function runQueue(tasks, limit) {
        let i = 0;
        const worker = async () => {
            while (i < tasks.length) {
                const t = tasks[i++];
                try { await t(); } catch (e) { console.warn(LOG, e); }
            }
        };
        return Promise.all(Array.from({ length: limit }, worker));
    }

    // ---------- znalezienie tabeli i kolumny Auftrag# ----------
    function findTarget() {
        for (const table of document.querySelectorAll('table')) {
            if (table.dataset.tmTicketDone) continue;
            for (const row of table.rows) {
                const cells = Array.from(row.cells);
                const idx = cells.findIndex(c => /^\s*Auftrag\s*#/i.test(c.textContent));
                if (idx > 0) return { table, headerRow: row, idx };
            }
        }
        return null;
    }

    function makeCell(tag) {
        const c = document.createElement(tag);
        c.style.textAlign = 'center';
        return c;
    }

    // ---------- dodatkowe sprawdzenie na podstawie kolumn tabeli ----------
    // Zamówienie ticketowe: wypełnione Duration (entry_confirm) + Order confirmation,
    // a PUSTE Duration (confirm_pay) + Payment day.
    function findColByHref(headerRow, part) {
        return Array.from(headerRow.cells).findIndex(c => {
            const a = c.querySelector('a');
            return a && (a.getAttribute('href') || '').includes(part);
        });
    }

    function isFilled(cell) {
        return !!cell && cell.textContent.trim() !== '';
    }

    function getColumnsCheck(headerRow) {
        const cols = {
            entryConfirm: findColByHref(headerRow, 'order=entry_confirm'),
            confirmation: findColByHref(headerRow, 'order=confirmation_date'),
            confirmPay: findColByHref(headerRow, 'order=confirm_pay'),
            payment: findColByHref(headerRow, 'dir=payment_date')
        };
        if (Object.values(cols).some(i => i < 0)) {
            console.warn(LOG, 'Ticket column: nie znaleziono wszystkich kolumn do dodatkowego sprawdzenia', cols);
            return () => null;
        }
        return (row) => {
            const c = row.cells;
            return isFilled(c[cols.entryConfirm]) && isFilled(c[cols.confirmation]) &&
                   !isFilled(c[cols.confirmPay]) && !isFilled(c[cols.payment]);
        };
    }

    // ---------- podsumowanie pod wykresem ----------
    const stats = { total: 0, done: 0 };
    let summaryBox = null;
    let summaryTable = null;

    function findChartHolder() {
        const plot = document.querySelector('path.amcharts-plot-area');
        if (!plot) return null;
        const svg = plot.closest('svg');
        const main = svg && svg.closest('.amcharts-main-div');
        return (main && main.parentElement) || (svg && svg.parentElement) || null;
    }

    function ensureSummaryBox() {
        if (summaryBox && document.contains(summaryBox)) return summaryBox;
        const box = document.createElement('div');
        box.id = 'tm-ticket-summary';
        box.style.cssText = 'margin:8px 0;padding:8px 12px;border-left:4px solid ' + BRAND +
            ';background:#f7f1f1;font:14px/1.5 Arial,sans-serif;display:inline-block;';
        const holder = findChartHolder();
        if (holder) {
            holder.after(box);
        } else if (summaryTable) {
            summaryTable.before(box); // fallback, gdy wykres się nie wyrenderował
        } else {
            return null;
        }
        summaryBox = box;
        return box;
    }

    function updateSummary() {
        const box = ensureSummaryBox();
        if (!box) return;
        const tickets = document.querySelectorAll('tr[data-ticket-order="1"]').length;
        const unknown = document.querySelectorAll('tr[data-ticket-unknown="1"]').length;
        const normal = stats.total - tickets - unknown;
        const pending = stats.total - stats.done;
        box.innerHTML =
            '<div><b>Orders:</b> ' + normal + ' <span style="color:#777">(bez ticketowych)</span></div>' +
            '<div><b>Orders from tickets:</b> ' + tickets + '</div>' +
            (unknown ? '<div style="color:#b00">Nie sprawdzono (błąd): ' + unknown + '</div>' : '') +
            (pending ? '<div style="color:#777">Sprawdzanie… pozostało: ' + pending + '</div>' : '');
    }

    // ---------- kolumna "Checked?" (checkboxy zapamiętywane lokalnie) ----------
    const CHECKED_KEY = 'tm_total_cycle_checked';
    const CHECKED_TTL_MS = 90 * 24 * 60 * 60 * 1000; // wpisy starsze niż 90 dni są czyszczone

    function loadChecked() {
        try {
            const raw = JSON.parse(localStorage.getItem(CHECKED_KEY) || '{}');
            const now = Date.now();
            const out = {};
            for (const k of Object.keys(raw)) {
                if (now - raw[k] < CHECKED_TTL_MS) out[k] = raw[k];
            }
            return out;
        } catch (e) { return {}; }
    }

    function setChecked(key, on) {
        // odczyt tuż przed zapisem – nie nadpisujemy zmian z innej karty
        const all = loadChecked();
        if (on) all[key] = Date.now(); else delete all[key];
        try { localStorage.setItem(CHECKED_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }

    // wstawia checkbox jako PIERWSZĄ komórkę wiersza (przed "#")
    function insertCheckbox(row, key, checkedMap) {
        const td = makeCell('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.title = 'Checked – zapamiętywane lokalnie w tej przeglądarce';
        cb.style.cursor = 'pointer';
        cb.checked = !!checkedMap[key];
        cb.addEventListener('change', () => setChecked(key, cb.checked));
        td.appendChild(cb);
        row.insertBefore(td, row.cells[0]);
    }

    function process() {
        const target = findTarget();
        if (!target) return;
        const { table, headerRow, idx } = target;
        table.dataset.tmTicketDone = '1';
        summaryTable = summaryTable || table;

        // indeksy kolumn liczone PRZED wstawieniem kolumny Ticket
        const columnsCheck = getColumnsCheck(headerRow);

        const checkedMap = loadChecked();
        const jobs = [];
        let mismatches = 0;

        for (const row of Array.from(table.rows)) {
            if (row === headerRow) {
                // klon nagłówka Auftrag# (bez dzieci) – zachowuje sticky/frozen style
                const th = row.cells[idx].cloneNode(false);
                th.textContent = 'Ticket';
                th.removeAttribute('title');
                th.style.textAlign = 'center';
                row.insertBefore(th, row.cells[idx]);

                // nagłówek kolumny Checked? – pierwsza kolumna, przed "#"
                const ch = th.cloneNode(false);
                ch.textContent = 'Checked?';
                ch.title = 'Zaznaczenia zapamiętywane lokalnie';
                row.insertBefore(ch, row.cells[0]);
                continue;
            }

            // wiersz z linkiem do zamówienia (np. 15757014/3)
            const aufCell = row.cells[idx];
            const m = aufCell && aufCell.textContent.match(/(\d{5,})\s*\/\s*(\d+)/);
            if (m) {
                const byColumns = columnsCheck(row); // true / false / null (brak kolumn)
                const td = makeCell('td');
                row.insertBefore(td, aufCell);
                insertCheckbox(row, m[1] + '/' + m[2], checkedMap);

                const markTicket = (title, rmaId) => {
                    td.innerHTML = '';
                    if (rmaId) {
                        const a = document.createElement('a');
                        a.href = '/rma.php?rma_id=' + rmaId;
                        a.target = '_blank';
                        a.title = title || ('Ticket #' + rmaId);
                        a.textContent = '✔️';
                        a.style.textDecoration = 'none';
                        td.appendChild(a);
                    } else {
                        td.textContent = '✔️';
                        if (title) td.title = title;
                    }
                    row.dataset.ticketOrder = '1';
                };

                jobs.push(async () => {
                    td.textContent = '…';
                    try {
                        // główna logika: tekst "Generated from Ticket#" w auftragu
                        const r = await checkOrder(m[1], m[2]);
                        if (r.ticket) {
                            let title = r.rmaId ? 'Ticket #' + r.rmaId : '';
                            if (byColumns === false) {
                                title += (title ? ' | ' : '') + 'Uwaga: kolumny dat wyglądają jak zwykłe zamówienie';
                                console.warn(LOG, 'Niezgodność (auftrag=ticket, kolumny=normalne):', m[1] + '/' + m[2]);
                                mismatches++;
                            }
                            markTicket(title, r.rmaId);
                        } else if (byColumns === true) {
                            // dodatkowe sprawdzenie sugeruje ticket, ale auftrag tego nie potwierdza
                            td.textContent = '⚠️';
                            td.title = 'Kolumny sugerują ticket, ale w auftragu brak "' + MARKER_TEXT + '"';
                            row.dataset.ticketMismatch = '1';
                            console.warn(LOG, 'Niezgodność (kolumny=ticket, auftrag=normalne):', m[1] + '/' + m[2]);
                            mismatches++;
                        } else {
                            td.textContent = '';
                        }
                    } catch (e) {
                        if (byColumns === true) {
                            // fallback: nie udało się pobrać auftragu – użyj tylko kolumn
                            markTicket('Wg kolumn tabeli (bez potwierdzenia w auftragu)', null);
                        } else {
                            td.textContent = '?';
                            td.title = 'Błąd sprawdzania: ' + e.message;
                            row.dataset.ticketUnknown = '1';
                        }
                    }
                });
                continue;
            }

            // wiersz podsumowania (TOTAL) – poszerz pierwszy colspan, żeby nie rozjechać tabeli
            const spanCell = Array.from(row.cells).find(c => c.colSpan > 1);
            // +2: kolumna Ticket i kolumna Checked?
            if (spanCell) {
                spanCell.colSpan = spanCell.colSpan + 2;
            } else if (row.cells.length) {
                row.appendChild(document.createElement('td'));
                row.appendChild(document.createElement('td'));
            }
        }

        console.log(LOG, 'Ticket column: sprawdzam', jobs.length, 'zamówień');
        stats.total += jobs.length;
        updateSummary();
        // wykres amCharts może się wyrenderować później – dopilnuj podsumowania pod nim
        let tries = 0;
        const timer = setInterval(() => {
            tries++;
            if (findChartHolder() && summaryBox && summaryBox.previousElementSibling !== findChartHolder()) {
                findChartHolder().after(summaryBox);
            }
            if (tries >= 20) clearInterval(timer);
        }, 500);

        const wrapped = jobs.map(job => async () => {
            try { await job(); } finally { stats.done++; updateSummary(); }
        });
        runQueue(wrapped, MAX_PARALLEL).then(() => {
            const count = table.querySelectorAll('tr[data-ticket-order="1"]').length;
            console.log(LOG, 'Ticket column: gotowe, ticketowych:', count, '| niezgodności:', mismatches);
        });
    }

    // ---------- przycisk "Yesterday" między "Today" a "Last 7 days" ----------
    function formatLocalDate(d) {
        const pad = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function addYesterdayButton() {
        if (document.getElementById('tm-yesterday')) return true;
        const today = document.getElementById('today');
        const week = document.getElementById('week');
        const from = document.getElementById('from');
        const to = document.getElementById('to');
        if (!today || !week || !from || !to) return false;

        const btn = document.createElement('input');
        btn.type = 'button';
        btn.id = 'tm-yesterday';
        btn.name = 'yesterday';
        btn.value = 'Yesterday';
        btn.className = today.className;
        btn.style.cssText = today.style.cssText;
        btn.addEventListener('click', () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const val = formatLocalDate(d);
            [from, to].forEach(el => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
        // dokładnie między Today a Last 7 days
        week.before(btn);

        // ── "Last Weekend + Mon": ostatni ZAKOŃCZONY weekend (sob + niedz) + poniedziałek po nim ──
        // Bierzemy ostatnią niedzielę ściśle przed dzisiaj, więc poniedziałek nigdy nie jest w przyszłości:
        //   dziś pon 26.10 -> sob 24.10 – pon 26.10 | dziś wt 27.10 -> to samo | dziś niedz 25.10 -> sob 17.10 – pon 19.10
        const weekendRange = () => {
            const now = new Date();
            const back = now.getDay() === 0 ? 7 : now.getDay(); // ile dni wstecz do ostatniej niedzieli (< dziś)
            const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back - 1);
            const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back + 1);
            return [formatLocalDate(sat), formatLocalDate(mon)];
        };
        const wbtn = document.createElement('input');
        wbtn.type = 'button';
        wbtn.id = 'tm-last-weekend';
        wbtn.name = 'last_weekend';
        wbtn.value = 'Last Weekend + Mon';
        wbtn.className = today.className;
        wbtn.style.cssText = today.style.cssText;
        wbtn.addEventListener('mouseenter', () => {
            const [a, b] = weekendRange();
            wbtn.title = a + ' → ' + b;
        });
        wbtn.addEventListener('click', () => {
            const [a, b] = weekendRange();
            from.value = a;
            to.value = b;
            [from, to].forEach(el => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
        btn.after(wbtn); // Yesterday | Last Weekend + Mon | Last 7 days
        return true;
    }

    if (!addYesterdayButton()) {
        let tries = 0;
        const t = setInterval(() => {
            if (addYesterdayButton() || ++tries >= 20) clearInterval(t);
        }, 500);
    }

    process();

    // gdyby wyniki ładowały się dynamicznie
    new MutationObserver(() => process()).observe(document.body, { childList: true, subtree: true });
})();

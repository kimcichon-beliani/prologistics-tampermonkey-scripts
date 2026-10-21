// ==UserScript==
// @name         Galaxus Partner Portal – Positions highlight + VAT
// @namespace    https://github.com/kimcichon-beliani
// @version      1.5.0
// @description  Wyroznia Manufacturer number, Quantity i Price per unit w tabeli pozycji + kwota z VAT; na OrderOverview dopisuje godzine zamowienia i dodaje kolumne "Checked?" z zapamietywanymi checkboxami
// @author       kimrioter
// @homepageURL  https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/galaxus-positions-highlight-vat.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/galaxus-positions-highlight-vat.user.js
// @match        https://partner.galaxus.ch/*/SupplierPurchaseOrder*
// @match        https://partner.galaxus.ch/*/SupplierPurchaseOrder/*
// @match        https://partner.galaxus.ch/*/OrderOverview*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /* ------------------------------------------------------------------
     * KONFIGURACJA
     * ------------------------------------------------------------------ */
    const VAT_RATE       = 8.1;        // stawka VAT w procentach (CH = 8.1, DE = 19, PL = 23)
    const VAT_DISPLAY    = 'inline';   // 'inline' = kwota brutto w tej samej komorce (nie rozpycha tabeli)
                                       // 'column' = osobna kolumna obok (tabela dostaje poziomy scroll)
    const SHOW_TOTAL_VAT = true;       // true = brutto liczone tez dla Total position
    const CURRENCY_HINT  = '';         // np. 'CHF' – dopisze walute przy kwocie brutto; '' = bez waluty
    const GROSS_LABEL    = '(cena do prolo)';   // podpis przy kwocie brutto; '' = bez podpisu
    const HEADER_HINT    = 'netto / brutto';    // podpis pod naglowkiem kolumn z cena; '' = bez podpisu

    const LOG   = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const GREEN = '#1d6b38';

    /* ------------------------------------------------------------------
     * NAGLOWKI, KTORYCH SZUKAMY (nowy layout + stare nazwy jako fallback)
     * ------------------------------------------------------------------ */
    const RE = {
        manufacturer: /^manufacturer\s*(no|key|number)\.?$/i,
        quantity:     /^quantity$/i,
        unitExcl:     /^(price\s*per\s*unit|unit\s*price\s*excl\.?)$/i,
        totalExcl:    /^(total\s*position|total\s*price\s*excl\.?)$/i
    };

    const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();

    /* Parsowanie kwoty: obsluga 74.00 / 1'110.06 / 1 110,06 / 1,110.06 */
    function parsePrice(raw) {
        let s = norm(raw).replace(/[A-Za-z]/g, '').replace(/[’'`´\s\u00A0]/g, '');
        if (s.includes(',') && s.includes('.')) {
            s = s.replace(/,/g, '');
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        }
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
    }

    /* Format w stylu strony: 1'110.06 */
    function formatPrice(n) {
        const s = n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return CURRENCY_HINT ? CURRENCY_HINT + ' ' + s : s;
    }

    /* ------------------------------------------------------------------
     * STYLE
     * ------------------------------------------------------------------ */
    function injectStyles() {
        if (document.getElementById('tm-gx-styles')) return;
        const css = `
            .tm-gx-key {
                background: #fdf6f6 !important;
                border-left: 1px solid #e6d0d0 !important;
                border-right: 1px solid #e6d0d0 !important;
                padding: 6px 9px !important;
            }
            .tm-gx-key, .tm-gx-key * {
                color: ${BRAND} !important;
                font-weight: 700 !important;
            }
            th.tm-gx-key, .tm-gx-head {
                background: #f7ebeb !important;
                border-bottom: 2px solid ${BRAND} !important;
            }
            .tm-gx-head, .tm-gx-head * {
                font-size: 11px !important;
                line-height: 1.35 !important;
                letter-spacing: .2px;
                white-space: normal !important;
            }
            .tm-gx-qty {
                text-align: center !important;
            }
            td.tm-gx-qty .spo-detail {
                font-size: 16px !important;
                line-height: 1.4 !important;
            }
            td.tm-gx-price {
                white-space: nowrap;
            }
            .tm-gx-gross {
                display: table;
                margin-top: 5px;
                padding-top: 4px;
                border-top: 1px dashed #c9dccf;
                color: ${GREEN} !important;
                font-weight: 700 !important;
                white-space: nowrap;
            }
            .tm-gx-gross-label {
                margin-left: 5px;
                color: #7d9a86 !important;
                font-weight: 400 !important;
                font-size: 10px !important;
                letter-spacing: .1px;
            }
            .tm-gx-hint {
                display: block;
                margin-top: 2px;
                color: #9a7c7c !important;
                font-weight: 400 !important;
                font-size: 9px !important;
                text-transform: none;
                letter-spacing: 0;
            }
            .tm-gx-vat {
                background: #f4faf6 !important;
                border-left: 1px solid #cde2d4 !important;
                border-right: 1px solid #cde2d4 !important;
                padding: 6px 9px !important;
            }
            .tm-gx-vat, .tm-gx-vat * {
                color: ${GREEN} !important;
                font-weight: 700 !important;
            }
            th.tm-gx-vat, .tm-gx-vat.tm-gx-head {
                background: #e9f4ed !important;
                border-bottom: 2px solid ${GREEN} !important;
            }
            .tm-gx-vat .tm-gx-gross {
                display: block;
                border-top: none;
                margin-top: 0;
                padding-top: 0;
            }
            .tm-gx-chk-cell, .tm-gx-chk-head {
                text-align: center !important;
                width: 70px;
            }
            .tm-gx-chk-cell input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: ${GREEN};
            }
            tr.tm-gx-row-checked > td {
                background: #eaf5ee !important;
            }
            .tm-gx-scroll {
                overflow-x: auto;
                max-width: 100%;
            }
        `;
        const style = document.createElement('style');
        style.id = 'tm-gx-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------
     * MAPOWANIE KOLUMN Z WIERSZA NAGLOWKA
     * ------------------------------------------------------------------ */
    function mapHeader(row) {
        const cells = Array.from(row.cells || []);
        if (cells.length < 4) return null;

        const map = { manufacturer: -1, quantity: -1, unitExcl: -1, totalExcl: -1, count: cells.length };
        cells.forEach((c, i) => {
            const t = norm(c.textContent);
            if (map.manufacturer < 0 && RE.manufacturer.test(t)) map.manufacturer = i;
            if (map.quantity     < 0 && RE.quantity.test(t))     map.quantity = i;
            if (map.unitExcl     < 0 && RE.unitExcl.test(t))     map.unitExcl = i;
            if (map.totalExcl    < 0 && RE.totalExcl.test(t))    map.totalExcl = i;
        });

        if (map.unitExcl < 0 || map.quantity < 0) return null;
        return map;
    }

    function addClass(cell, ...classes) {
        if (cell) cell.classList.add(...classes);
    }

    function makeCell(sample) {
        return document.createElement(sample && sample.tagName === 'TH' ? 'th' : 'td');
    }

    function grossSpan(net, withLabel) {
        const gross = net * (1 + VAT_RATE / 100);
        const span = document.createElement('span');
        span.className = 'tm-gx-gross';
        span.textContent = formatPrice(gross);
        span.title = `${formatPrice(net)} + ${VAT_RATE}% VAT = ${formatPrice(gross)}`;
        if (withLabel && GROSS_LABEL) {
            const label = document.createElement('span');
            label.className = 'tm-gx-gross-label';
            label.textContent = GROSS_LABEL;
            span.appendChild(label);
        }
        return span;
    }

    /* ------------------------------------------------------------------
     * GLOWNA LOGIKA
     * ------------------------------------------------------------------ */
    function processTable(table) {
        const rows = Array.from(table.rows || []);
        let headerRow = null, map = null;

        for (const row of rows) {
            const m = mapHeader(row);
            if (m) { headerRow = row; map = m; break; }
        }
        if (!headerRow) return 0;

        const targets = [{ after: map.unitExcl, src: map.unitExcl }];
        if (SHOW_TOTAL_VAT && map.totalExcl >= 0) {
            targets.push({ after: map.totalExcl, src: map.totalExcl });
        }
        // malejaco – wstawianie kolumn nie przesuwa wczesniejszych indeksow
        targets.sort((a, b) => b.after - a.after);

        // --- naglowek: tylko raz ---
        if (headerRow.dataset.tmGx !== '1') {
            addClass(headerRow.cells[map.manufacturer], 'tm-gx-key', 'tm-gx-head');
            addClass(headerRow.cells[map.quantity],     'tm-gx-key', 'tm-gx-qty', 'tm-gx-head');
            addClass(headerRow.cells[map.unitExcl],     'tm-gx-key', 'tm-gx-price', 'tm-gx-head');

            targets.forEach((t) => {
                if (VAT_DISPLAY === 'column') {
                    const cell = makeCell(headerRow.cells[t.after]);
                    cell.className = 'tm-gx-vat tm-gx-head';
                    cell.textContent = `incl. ${VAT_RATE}% VAT`;
                    headerRow.insertBefore(cell, headerRow.cells[t.after + 1] || null);
                } else if (HEADER_HINT && headerRow.cells[t.after]) {
                    const hint = document.createElement('span');
                    hint.className = 'tm-gx-hint';
                    hint.textContent = `${HEADER_HINT} (+${VAT_RATE}% VAT)`;
                    (headerRow.cells[t.after].querySelector('.tablesorter-header-inner') || headerRow.cells[t.after]).appendChild(hint);
                }
            });
            headerRow.dataset.tmGx = '1';

            if (VAT_DISPLAY === 'column' && table.parentElement && !table.parentElement.classList.contains('tm-gx-scroll')) {
                const wrap = document.createElement('div');
                wrap.className = 'tm-gx-scroll';
                table.parentElement.insertBefore(wrap, table);
                wrap.appendChild(table);
            }
        }

        // w trybie 'column' naglowek ma dodatkowe komorki – dane porownujemy z oryginalna liczba kolumn
        const baseCount = map.count;
        const colShift = (VAT_DISPLAY === 'column') ? targets.length : 0;

        // --- wiersze z danymi (sprawdzane przy kazdym przebiegu – strona odswieza wiersze po zapisie) ---
        let done = 0;
        const startIdx = rows.indexOf(headerRow) + 1;

        for (let i = startIdx; i < rows.length; i++) {
            const row = rows[i];
            if (VAT_DISPLAY === 'column' && row.dataset.tmGx === '1') continue;
            if (row.cells.length < baseCount) continue;   // wiersze pagerow, podsumowan itp.

            addClass(row.cells[map.manufacturer], 'tm-gx-key');
            addClass(row.cells[map.quantity],     'tm-gx-key', 'tm-gx-qty');
            addClass(row.cells[map.unitExcl],     'tm-gx-key', 'tm-gx-price');

            // w trybie inline pomijamy komorki, ktore juz maja kwote brutto
            const todo = targets.filter((t) => {
                const c = row.cells[t.src];
                return c && (VAT_DISPLAY === 'column' || !c.querySelector('.tm-gx-gross'));
            });
            if (!todo.length) continue;

            // wartosci odczytujemy PRZED modyfikacja komorek
            const values = todo.map((t) => parsePrice(row.cells[t.src].textContent));

            todo.forEach((t, idx) => {
                const net = values[idx];

                if (VAT_DISPLAY === 'column') {
                    const cell = makeCell(row.cells[t.after]);
                    cell.className = 'tm-gx-vat';
                    if (net === null) {
                        cell.textContent = '–';
                    } else {
                        cell.appendChild(grossSpan(net, false));
                    }
                    row.insertBefore(cell, row.cells[t.after + 1] || null);
                } else if (net !== null) {
                    row.cells[t.src].appendChild(grossSpan(net, true));
                }
            });

            row.dataset.tmGx = '1';
            done++;
        }
        return done;
    }

    /* ------------------------------------------------------------------
     * ORDER OVERVIEW – godzina zamowienia pod data
     * Lista pokazuje tylko date; godzine pobieramy ze strony zamowienia
     * (/SupplierPurchaseOrder/<id>) i dopisujemy w komorce "Order date".
     * ------------------------------------------------------------------ */
    const SHOW_ORDER_TIME = true;
    const TIME_CACHE_PREFIX = 'tmgx-order-time:';
    const MAX_PARALLEL = 3;           // ile zamowien pobieramy rownolegle
    let activeFetches = 0;
    const fetchQueue = [];

    function cacheGet(id) {
        try { return localStorage.getItem(TIME_CACHE_PREFIX + id); } catch (e) { return null; }
    }
    function cacheSet(id, val) {
        try { localStorage.setItem(TIME_CACHE_PREFIX + id, val); } catch (e) { /* ignore */ }
    }

    function extractOrderTime(html, dateStr) {
        const text = html
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;|&#160;/g, ' ')
            .replace(/\s+/g, ' ');
        const T = '[\\s,;|-]*(?:at|um|o)?\\s*(\\d{1,2}:\\d{2})(?::\\d{2})?';

        // 1) "Order date 21.10.2026 14:32"
        let m = text.match(new RegExp('Order date[^0-9]{0,20}(\\d{2}\\.\\d{2}\\.\\d{4})' + T, 'i'));
        if (m) return m[2];

        // 2) dowolne wystapienie daty z listy tuz przed godzina
        if (dateStr) {
            m = text.match(new RegExp(dateStr.replace(/\./g, '\\.') + T));
            if (m) return m[1];
        }
        return null;
    }

    function showTime(cell, time) {
        cell.dataset.tmGxTime = 'done';
        if (cell.querySelector('.tm-gx-time')) return;
        const span = document.createElement('span');
        span.className = 'tm-gx-time';
        span.textContent = time;
        span.style.cssText = `display:block;margin-top:2px;font-weight:700;color:${BRAND};white-space:nowrap;`;
        cell.appendChild(span);
    }

    async function loadTime(id, url, dateStr, cell) {
        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const html = await res.text();
            const time = extractOrderTime(html, dateStr);
            if (time) {
                cacheSet(id, time);
                showTime(cell, time);
            } else {
                cell.dataset.tmGxTime = 'none';
                console.warn(`${LOG} nie znaleziono godziny w zamowieniu ${id}`);
            }
        } catch (e) {
            cell.dataset.tmGxTime = 'fail';
            console.warn(`${LOG} blad pobierania zamowienia ${id}:`, e);
        }
    }

    function pump() {
        while (activeFetches < MAX_PARALLEL && fetchQueue.length) {
            const job = fetchQueue.shift();
            activeFetches++;
            job().finally(() => { activeFetches--; pump(); });
        }
    }

    function processOrderOverview() {
        if (!SHOW_ORDER_TIME || !/OrderOverview/i.test(location.pathname)) return;

        document.querySelectorAll('table').forEach((table) => {
            const rows = Array.from(table.rows || []);
            const headRow = rows.find((r) => r.querySelector('th'));
            if (!headRow) return;

            const heads = Array.from(headRow.cells).map((c) => norm(c.textContent));
            const idIdx   = heads.findIndex((t) => /^order\s*id$/i.test(t));
            const dateIdx = heads.findIndex((t) => /^order\s*date$/i.test(t));
            if (idIdx < 0 || dateIdx < 0) return;

            rows.forEach((row) => {
                if (row === headRow || row.cells.length < heads.length) return;

                const dateCell = row.cells[dateIdx];
                if (!dateCell || dateCell.dataset.tmGxTime) return;

                const link = row.cells[idIdx].querySelector('a[href*="SupplierPurchaseOrder"]');
                if (!link) return;
                const idMatch = link.getAttribute('href').match(/SupplierPurchaseOrder\/(\d+)/);
                if (!idMatch) return;
                const id = idMatch[1];

                const dateStr = (norm(dateCell.textContent).match(/\d{2}\.\d{2}\.\d{4}/) || [''])[0];

                dateCell.dataset.tmGxTime = 'pending';
                const cached = cacheGet(id);
                if (cached) { showTime(dateCell, cached); return; }

                fetchQueue.push(() => loadTime(id, link.href, dateStr, dateCell));
            });
        });
        pump();
    }

    /* ------------------------------------------------------------------
     * ORDER OVERVIEW – kolumna "Checked?" z zapamietywanymi checkboxami
     * Stan trzymany w localStorage (klucz tmgx-checked-orders): { "<id>": timestamp }
     * ------------------------------------------------------------------ */
    const SHOW_CHECKED  = true;
    const CHECKED_TITLE = 'Checked?';
    const CHECKED_KEY   = 'tmgx-checked-orders';

    function loadChecked() {
        try { return JSON.parse(localStorage.getItem(CHECKED_KEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function saveChecked(map) {
        try { localStorage.setItem(CHECKED_KEY, JSON.stringify(map)); } catch (e) { console.warn(`${LOG} nie mozna zapisac Checked:`, e); }
    }

    function processOrderChecked() {
        if (!SHOW_CHECKED || !/OrderOverview/i.test(location.pathname)) return;

        const checked = loadChecked();

        document.querySelectorAll('table').forEach((table) => {
            const rows = Array.from(table.rows || []);
            const headRow = rows.find((r) => r.querySelector('th'));
            if (!headRow) return;

            const heads = Array.from(headRow.cells).map((c) => norm(c.textContent));
            const idIdx = heads.findIndex((t) => /^order\s*id$/i.test(t));
            if (idIdx < 0) return;

            // naglowek kolumny (raz)
            const hadHead = !!headRow.querySelector('th.tm-gx-chk-head');
            if (!hadHead) {
                const th = document.createElement('th');
                th.className = 'index tm-gx-chk-head';
                th.textContent = CHECKED_TITLE;
                headRow.appendChild(th);
            }
            const baseCount = hadHead ? heads.length - 1 : heads.length;

            rows.forEach((row) => {
                if (row === headRow || row.cells.length < baseCount) return;
                if (row.querySelector('td.tm-gx-chk-cell')) return;   // juz ma checkbox

                const link = row.cells[idIdx].querySelector('a[href*="SupplierPurchaseOrder"]');
                const idMatch = link && link.getAttribute('href').match(/SupplierPurchaseOrder\/(\d+)/);
                if (!idMatch) return;
                const id = idMatch[1];

                const td = document.createElement('td');
                td.className = 'tm-gx-chk-cell';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.title = 'Zaznacz, jesli to zamowienie bylo juz sprawdzone';
                cb.checked = !!checked[id];
                row.classList.toggle('tm-gx-row-checked', cb.checked);

                cb.addEventListener('change', () => {
                    const map = loadChecked();   // swiezy stan (np. z drugiej karty)
                    if (cb.checked) map[id] = Date.now(); else delete map[id];
                    saveChecked(map);
                    row.classList.toggle('tm-gx-row-checked', cb.checked);
                });

                td.appendChild(cb);
                row.appendChild(td);
            });
        });
    }

    let busy = false;

    function run() {
        if (busy) return;
        busy = true;
        try {
            injectStyles();
            let total = 0;
            document.querySelectorAll('table').forEach((t) => { total += processTable(t); });
            processOrderChecked();    // najpierw checkboxy (dodaja kolumne), potem godziny
            processOrderOverview();
            if (total > 0) {
                console.log(`${LOG} Positions: podswietlono kolumny i doliczono ${VAT_RATE}% VAT w ${total} wierszu/ach (tryb: ${VAT_DISPLAY}).`);
            }
        } catch (e) {
            console.error(`${LOG} blad:`, e);
        } finally {
            busy = false;
        }
    }

    /* ------------------------------------------------------------------
     * START + obserwacja zmian (strona przeladowuje wiersze po edycji/zapisie)
     * ------------------------------------------------------------------ */
    run();

    let timer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(run, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();

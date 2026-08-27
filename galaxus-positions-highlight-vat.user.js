// ==UserScript==
// @name         Galaxus Partner Portal – Positions highlight + VAT
// @namespace    https://github.com/kimcichon-beliani
// @version      1.2.2
// @description  Wyroznia Manufacturer no., Quantity i Unit price excl w sekcji Positions oraz pokazuje kwote z doliczonym VAT
// @author       kimrioter
// @homepageURL  https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/galaxus-positions-highlight-vat.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/galaxus-positions-highlight-vat.user.js
// @match        https://partner.galaxus.ch/*/SupplierPurchaseOrder*
// @match        https://partner.galaxus.ch/*/SupplierPurchaseOrder/*
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
    const SHOW_TOTAL_VAT = true;       // true = brutto liczone tez dla Total price excl
    const CURRENCY_HINT  = '';         // np. 'CHF' – dopisze walute przy kwocie brutto; '' = bez waluty
    const GROSS_LABEL    = '(cena do prolo)';   // podpis przy kwocie brutto; '' = bez podpisu
    const HEADER_HINT    = 'netto / brutto';    // podpis pod naglowkiem kolumn z cena; '' = bez podpisu

    const LOG   = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const GREEN = '#1d6b38';

    /* ------------------------------------------------------------------
     * NAGLOWKI, KTORYCH SZUKAMY
     * ------------------------------------------------------------------ */
    const RE = {
        manufacturer: /^manufacturer\s*(no|key)\.?$/i,
        quantity:     /^quantity$/i,
        unitExcl:     /^unit\s*price\s*excl\.?$/i,
        totalExcl:    /^total\s*price\s*excl\.?$/i
    };

    const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();

    /* Parsowanie kwoty: obsluga 1'110.06 / 1 110,06 / 1,110.06 */
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
     * STYLE – celowo oszczedne, zeby nie rozpychac kolumn
     * ------------------------------------------------------------------ */
    function injectStyles() {
        if (document.getElementById('tm-gx-styles')) return;
        const css = `
            /* --- wyroznione kolumny: delikatne tlo + cienkie ramki zamiast grubych paskow --- */
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
            td.tm-gx-qty, td.tm-gx-qty * {
                font-size: 16px !important;
                line-height: 1.4 !important;
            }
            td.tm-gx-price {
                white-space: nowrap;
            }
            /* --- kwota brutto pod cena netto --- */
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
            /* --- tryb 'column' --- */
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

        // bez ceny jednostkowej i ilosci to nie jest tabela Positions
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
        if (!headerRow || headerRow.dataset.tmGx === '1') return 0;

        const targets = [{ after: map.unitExcl, src: map.unitExcl }];
        if (SHOW_TOTAL_VAT && map.totalExcl >= 0) {
            targets.push({ after: map.totalExcl, src: map.totalExcl });
        }
        // malejaco – dzieki temu wstawianie kolumn nie przesuwa wczesniejszych indeksow
        targets.sort((a, b) => b.after - a.after);

        // --- naglowek ---
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
                headerRow.cells[t.after].appendChild(hint);
            }
        });
        headerRow.dataset.tmGx = '1';

        // w trybie 'column' tabela robi sie szersza – dajemy jej wlasny scroll,
        // zeby nie rozjechal sie caly layout strony
        if (VAT_DISPLAY === 'column' && table.parentElement && !table.parentElement.classList.contains('tm-gx-scroll')) {
            const wrap = document.createElement('div');
            wrap.className = 'tm-gx-scroll';
            table.parentElement.insertBefore(wrap, table);
            wrap.appendChild(table);
        }

        // --- wiersze z danymi ---
        let done = 0;
        const startIdx = rows.indexOf(headerRow) + 1;

        for (let i = startIdx; i < rows.length; i++) {
            const row = rows[i];
            if (row.dataset.tmGx === '1') continue;
            if (row.cells.length < map.count) continue;   // wiersze "Results 1-1 of 1", pagery itd.

            addClass(row.cells[map.manufacturer], 'tm-gx-key');
            addClass(row.cells[map.quantity],     'tm-gx-key', 'tm-gx-qty');
            addClass(row.cells[map.unitExcl],     'tm-gx-key', 'tm-gx-price');

            // wartosci odczytujemy PRZED modyfikacja komorek
            const values = targets.map((t) => parsePrice(row.cells[t.src] ? row.cells[t.src].textContent : ''));

            targets.forEach((t, idx) => {
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
                } else if (net !== null && row.cells[t.src]) {
                    row.cells[t.src].appendChild(grossSpan(net, true));
                }
            });

            row.dataset.tmGx = '1';
            done++;
        }
        return done;
    }

    let busy = false;

    function run() {
        if (busy) return;
        busy = true;
        try {
            injectStyles();
            let total = 0;
            document.querySelectorAll('table').forEach((t) => { total += processTable(t); });
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
     * START + obserwacja zmian (strona przeladowuje sekcje po Search/Save)
     * ------------------------------------------------------------------ */
    run();

    let timer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(run, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();

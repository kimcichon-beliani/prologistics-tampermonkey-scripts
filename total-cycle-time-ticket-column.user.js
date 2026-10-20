// ==UserScript==
// @name         Total Cycle Time – kolumna Ticket
// @namespace    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @version      1.0.0
// @description  Dodaje kolumnę "Ticket" (między # a Auftrag#) i oznacza ✔️ zamówienia wygenerowane z ticketu (RMA)
// @author       kimrioter
// @match        https://www.prologistics.info/total_cycle_time.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/total-cycle-time-ticket-column.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/total-cycle-time-ticket-column.user.js
// ==/UserScript==

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
                const idx = cells.findIndex(c => /^\s*Auftrag\s*#?\s*$/i.test(c.textContent));
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

    function process() {
        const target = findTarget();
        if (!target) return;
        const { table, headerRow, idx } = target;
        table.dataset.tmTicketDone = '1';

        const jobs = [];

        for (const row of Array.from(table.rows)) {
            if (row === headerRow) {
                const th = makeCell(row.cells[idx].tagName.toLowerCase());
                th.textContent = 'Ticket';
                th.style.color = BRAND;
                row.insertBefore(th, row.cells[idx]);
                continue;
            }

            // wiersz z linkiem do zamówienia (np. 15757014/3)
            const aufCell = row.cells[idx];
            const m = aufCell && aufCell.textContent.match(/(\d{5,})\s*\/\s*(\d+)/);
            if (m) {
                const td = makeCell('td');
                row.insertBefore(td, aufCell);
                jobs.push(async () => {
                    td.textContent = '…';
                    try {
                        const r = await checkOrder(m[1], m[2]);
                        if (r.ticket) {
                            td.innerHTML = '';
                            if (r.rmaId) {
                                const a = document.createElement('a');
                                a.href = '/rma.php?rma_id=' + r.rmaId;
                                a.target = '_blank';
                                a.title = 'Ticket #' + r.rmaId;
                                a.textContent = '✔️';
                                a.style.textDecoration = 'none';
                                td.appendChild(a);
                            } else {
                                td.textContent = '✔️';
                            }
                            row.dataset.ticketOrder = '1';
                        } else {
                            td.textContent = '';
                        }
                    } catch (e) {
                        td.textContent = '?';
                        td.title = 'Błąd sprawdzania: ' + e.message;
                    }
                });
                continue;
            }

            // wiersz podsumowania (TOTAL) – poszerz pierwszy colspan, żeby nie rozjechać tabeli
            const spanCell = Array.from(row.cells).find(c => c.colSpan > 1);
            if (spanCell) {
                spanCell.colSpan = spanCell.colSpan + 1;
            } else if (row.cells.length) {
                row.appendChild(document.createElement('td'));
            }
        }

        console.log(LOG, 'Ticket column: sprawdzam', jobs.length, 'zamówień');
        runQueue(jobs, MAX_PARALLEL).then(() => {
            const count = table.querySelectorAll('tr[data-ticket-order="1"]').length;
            console.log(LOG, 'Ticket column: gotowe, ticketowych:', count);
        });
    }

    process();

    // gdyby wyniki ładowały się dynamicznie
    new MutationObserver(() => process()).observe(document.body, { childList: true, subtree: true });
})();

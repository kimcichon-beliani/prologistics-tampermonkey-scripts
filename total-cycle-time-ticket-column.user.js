// ==UserScript==
// @name         Total Cycle Time – kolumna Ticket
// @namespace    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @version      1.2.0
// @description  Dodaje kolumnę "Ticket" (między # a Auftrag#), oznacza ✔️ zamówienia z ticketu (RMA) i pokazuje podsumowanie pod wykresem
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

    function process() {
        const target = findTarget();
        if (!target) return;
        const { table, headerRow, idx } = target;
        table.dataset.tmTicketDone = '1';
        summaryTable = summaryTable || table;

        // indeksy kolumn liczone PRZED wstawieniem kolumny Ticket
        const columnsCheck = getColumnsCheck(headerRow);

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
                continue;
            }

            // wiersz z linkiem do zamówienia (np. 15757014/3)
            const aufCell = row.cells[idx];
            const m = aufCell && aufCell.textContent.match(/(\d{5,})\s*\/\s*(\d+)/);
            if (m) {
                const byColumns = columnsCheck(row); // true / false / null (brak kolumn)
                const td = makeCell('td');
                row.insertBefore(td, aufCell);

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
            if (spanCell) {
                spanCell.colSpan = spanCell.colSpan + 1;
            } else if (row.cells.length) {
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

    process();

    // gdyby wyniki ładowały się dynamicznie
    new MutationObserver(() => process()).observe(document.body, { childList: true, subtree: true });
})();

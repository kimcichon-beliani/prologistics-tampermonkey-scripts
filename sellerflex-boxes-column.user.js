// ==UserScript==
// @name         Seller Flex - kolumna Boxes
// @namespace    kimcichon-beliani
// @version      1.1
// @description  Dodaje kolumnę "Boxes" do listy zamówień Seller Flex (pobiera dane ze szczegółów zamówienia)
// @author       kimrioter
// @match        https://sellerflex.amazon.de/orders/all*
// @noframes
// @grant        none
// @updateURL    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/main/sellerflex-boxes-column.user.js
// @downloadURL  https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/main/sellerflex-boxes-column.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const DETAILS_TABLE_SELECTOR = 'table.awui-order-details-table';
    const MAX_CONCURRENT = 3;          // ile iframe'ów naraz
    const IFRAME_TIMEOUT_MS = 20000;   // max czas oczekiwania na szczegóły
    const CACHE_PREFIX = 'sf_boxes_';
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

    // ---------- cache ----------
    function cacheGet(key) {
        try {
            const raw = localStorage.getItem(CACHE_PREFIX + key);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (Date.now() - obj.t > CACHE_TTL_MS) return null;
            return obj.v;
        } catch (e) { return null; }
    }
    function cacheSet(key, value) {
        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
        } catch (e) { /* ignore */ }
    }

    // ---------- kolejka pobierania ----------
    const queue = [];
    let running = 0;
    const inFlight = new Map();

    function fetchBoxes(href, key) {
        if (inFlight.has(key)) return inFlight.get(key);
        const p = new Promise((resolve, reject) => {
            queue.push({ href, resolve, reject });
            processQueue();
        });
        inFlight.set(key, p);
        const clear = () => inFlight.delete(key);
        p.then(clear, clear);
        return p;
    }

    function processQueue() {
        while (running < MAX_CONCURRENT && queue.length) {
            const job = queue.shift();
            running++;
            loadInIframe(job.href)
                .then(job.resolve, job.reject)
                .finally(() => {
                    running--;
                    processQueue();
                });
        }
    }

    function loadInIframe(href) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:800px;visibility:hidden;';
            iframe.src = href;

            const started = Date.now();
            const timer = setInterval(() => {
                try {
                    const doc = iframe.contentDocument;
                    if (doc) {
                        const result = parseDetails(doc);
                        if (result !== undefined) {
                            clearInterval(timer);
                            iframe.remove();
                            resolve(result);
                            return;
                        }
                    }
                } catch (e) { /* iframe jeszcze się ładuje */ }

                if (Date.now() - started > IFRAME_TIMEOUT_MS) {
                    clearInterval(timer);
                    iframe.remove();
                    reject(new Error('timeout'));
                }
            }, 400);

            document.body.appendChild(iframe);
        });
    }

    // undefined = tabela jeszcze się nie wyrenderowała
    // null      = tabela jest, ale brak liczby w Boxes
    // number    = suma Boxes
    function parseDetails(doc) {
        const table = doc.querySelector(DETAILS_TABLE_SELECTOR);
        if (!table) return undefined;

        const ths = Array.from(table.querySelectorAll('thead th'));
        const idx = ths.findIndex(th => th.textContent.trim() === 'Boxes');
        if (idx === -1) return undefined;

        const itemRows = Array.from(table.querySelectorAll('tbody tr'))
            .filter(tr => tr.querySelector('[data-testid="shipment-sku-item-row"]'));
        if (!itemRows.length) return undefined;

        let sum = 0;
        let found = false;
        for (const tr of itemRows) {
            const cell = tr.querySelectorAll('td')[idx];
            const n = parseInt((cell ? cell.textContent : '').trim(), 10);
            if (!isNaN(n)) { sum += n; found = true; }
        }
        return found ? sum : null;
    }

    // ---------- helpery DOM (bez innerHTML – Trusted Types) ----------
    function makeCell(tag, className, text) {
        const el = document.createElement(tag);
        el.className = className;
        const span = document.createElement('span');
        span.textContent = text;
        el.appendChild(span);
        return el;
    }

    function setCell(td, text, title) {
        const span = td.querySelector('span');
        if (span) span.textContent = text;
        td.title = title || '';
    }

    function shipmentKey(href) {
        const m = href.match(/\/orders\/details\/([^/?#]+)/);
        return m ? m[1] : href;
    }

    function findTable() {
        let table = document.querySelector('table[data-testid="all-orders-table"]');
        if (table) return table;
        const th = document.querySelector('[data-testid="orders-header-cell-orderId"]');
        return th ? th.closest('table') : null;
    }

    // ---------- modyfikacja tabeli na liście ----------
    function processTable() {
        const table = findTable();
        if (!table) return;

        const headRow = table.querySelector('thead tr');
        if (headRow && !headRow.querySelector('th.sf-boxes-th')) {
            const lastTh = headRow.querySelector('th:last-child');
            const cls = (lastTh ? lastTh.className : '') + ' sf-boxes-th';
            const th = makeCell('th', cls, 'Boxes');
            th.setAttribute('scope', 'col');
            headRow.appendChild(th);
            console.log(LOG, 'Dodano nagłówek Boxes');
        }

        table.querySelectorAll('tbody tr').forEach(tr => {
            if (tr.querySelector('td.sf-boxes-td')) return;

            const link = tr.querySelector('a[data-testid="single-order-details-link"]');
            if (!link) return;
            const href = link.getAttribute('href');
            const key = shipmentKey(href);

            const lastTd = tr.querySelector('td:last-child');
            const td = makeCell('td', (lastTd ? lastTd.className : '') + ' sf-boxes-td', '…');
            tr.appendChild(td);

            const show = val => setCell(td, val === null ? '-' : String(val));

            const cached = cacheGet(key);
            if (cached !== null && cached !== undefined) {
                show(cached === 'none' ? null : cached);
                return;
            }

            const load = () => {
                setCell(td, '…');
                fetchBoxes(new URL(href, location.origin).href, key)
                    .then(val => {
                        cacheSet(key, val === null ? 'none' : val);
                        show(val);
                    })
                    .catch(err => {
                        console.warn(LOG, 'Błąd pobierania', key, err);
                        setCell(td, '?', 'Błąd pobierania – kliknij, aby spróbować ponownie');
                        td.style.cursor = 'pointer';
                        td.onclick = () => { td.onclick = null; td.style.cursor = ''; load(); };
                    });
            };
            load();
        });
    }

    function safeProcess() {
        try { processTable(); } catch (e) { console.error(LOG, e); }
    }

    // ---------- obserwator + zabezpieczenie interwałem ----------
    let debounce = null;
    new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(safeProcess, 300);
    }).observe(document.body, { childList: true, subtree: true });

    setInterval(safeProcess, 1500);
    safeProcess();
    console.log(LOG, 'Skrypt Boxes uruchomiony');
})();

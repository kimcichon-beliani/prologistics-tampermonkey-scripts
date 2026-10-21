// ==UserScript==
// @name         Seller Flex - kolumna Boxes
// @namespace    kimcichon-beliani
// @version      1.0
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

    const TABLE_SELECTOR = 'table[data-testid="all-orders-table"]';
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
    const inFlight = new Map(); // key -> Promise

    function fetchBoxes(href, key) {
        if (inFlight.has(key)) return inFlight.get(key);
        const p = new Promise((resolve, reject) => {
            queue.push({ href, key, resolve, reject });
            processQueue();
        }).finally(() => inFlight.delete(key));
        inFlight.set(key, p);
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
            let timer = null;

            const cleanup = () => {
                clearInterval(timer);
                iframe.remove();
            };

            timer = setInterval(() => {
                try {
                    const doc = iframe.contentDocument;
                    if (doc) {
                        const result = parseDetails(doc);
                        if (result !== null) {
                            cleanup();
                            resolve(result);
                            return;
                        }
                    }
                } catch (e) { /* iframe jeszcze się ładuje */ }

                if (Date.now() - started > IFRAME_TIMEOUT_MS) {
                    cleanup();
                    reject(new Error('timeout'));
                }
            }, 400);

            document.body.appendChild(iframe);
        });
    }

    // zwraca sumę Boxes albo null, jeśli tabela jeszcze się nie wyrenderowała
    function parseDetails(doc) {
        const table = doc.querySelector(DETAILS_TABLE_SELECTOR);
        if (!table) return null;

        const ths = [...table.querySelectorAll('thead th')];
        const idx = ths.findIndex(th => th.textContent.trim() === 'Boxes');
        if (idx === -1) return null;

        const itemRows = [...table.querySelectorAll('tbody tr')]
            .filter(tr => tr.querySelector('[data-testid="shipment-sku-item-row"]'));
        if (!itemRows.length) return null;

        let sum = 0;
        for (const tr of itemRows) {
            const cell = tr.querySelectorAll('td')[idx];
            const n = parseInt((cell ? cell.textContent : '').trim(), 10);
            if (!isNaN(n)) sum += n;
        }
        return sum;
    }

    // ---------- modyfikacja tabeli na liście ----------
    function shipmentKey(href) {
        const m = href.match(/\/orders\/details\/([^/?#]+)/);
        return m ? m[1] : href;
    }

    function setCell(td, text, title) {
        td.querySelector('span').textContent = text;
        td.title = title || '';
    }

    function processTable() {
        const table = document.querySelector(TABLE_SELECTOR);
        if (!table) return;

        // nagłówek
        const headRow = table.querySelector('thead tr');
        if (headRow && !headRow.querySelector('th.sf-boxes-th')) {
            const lastTh = headRow.querySelector('th:last-child');
            const th = document.createElement('th');
            th.className = (lastTh ? lastTh.className : '') + ' sf-boxes-th';
            th.setAttribute('scope', 'col');
            th.innerHTML = '<span>Boxes</span>';
            headRow.appendChild(th);
        }

        // wiersze
        table.querySelectorAll('tbody tr').forEach(tr => {
            if (tr.querySelector('td.sf-boxes-td')) return;

            const link = tr.querySelector('a[data-testid="single-order-details-link"]');
            if (!link) return;
            const href = link.getAttribute('href');
            const key = shipmentKey(href);

            const lastTd = tr.querySelector('td:last-child');
            const td = document.createElement('td');
            td.className = (lastTd ? lastTd.className : '') + ' sf-boxes-td';
            td.innerHTML = '<span>…</span>';
            tr.appendChild(td);

            const cached = cacheGet(key);
            if (cached !== null) {
                setCell(td, String(cached));
                return;
            }

            const load = () => {
                setCell(td, '…');
                fetchBoxes(new URL(href, location.origin).href, key)
                    .then(val => {
                        cacheSet(key, val);
                        setCell(td, String(val));
                    })
                    .catch(() => {
                        setCell(td, '?', 'Błąd pobierania – kliknij, aby spróbować ponownie');
                        td.style.cursor = 'pointer';
                        td.onclick = () => { td.onclick = null; td.style.cursor = ''; load(); };
                    });
            };
            load();
        });
    }

    // ---------- obserwator (React przerysowuje tabelę) ----------
    let debounce = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            observer.disconnect();
            try { processTable(); } finally {
                observer.observe(document.body, { childList: true, subtree: true });
            }
        }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    processTable();
})();

// ==UserScript==
// @name         Seller Flex - kolumna Boxes
// @namespace    kimcichon-beliani
// @version      1.4
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
    const MAX_CONCURRENT = 3;
    const IFRAME_TIMEOUT_MS = 25000;
    const OLD_CACHE_PREFIX = 'sf_boxes_';
    const CACHE_PREFIX = 'sf_boxes_v2_';
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

    // ---------- czyszczenie starego cache (v1.0 - v1.2) ----------
    try {
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith(OLD_CACHE_PREFIX) && !k.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(k);
            }
        });
    } catch (e) { /* ignore */ }

    // ---------- cache (tylko liczby) ----------
    function cacheGet(key) {
        try {
            const raw = localStorage.getItem(CACHE_PREFIX + key);
            if (!raw) return undefined;
            const obj = JSON.parse(raw);
            if (Date.now() - obj.t > CACHE_TTL_MS) return undefined;
            return typeof obj.v === 'number' ? obj.v : undefined;
        } catch (e) { return undefined; }
    }
    function cacheSet(key, value) {
        if (typeof value !== 'number') return;
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

    function describeIframe(iframe) {
        try {
            const d = iframe.contentDocument;
            const tables = Array.from(d.querySelectorAll('table')).map((t, i) =>
                'T' + i + '[th=' + Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim()).join('/') +
                '; wiersze=' + t.querySelectorAll('tbody tr').length + ']');
            return 'url=' + iframe.contentWindow.location.href +
                ' | readyState=' + d.readyState +
                ' | itemRows=' + d.querySelectorAll('[data-testid="shipment-sku-item-row"]').length +
                ' | ' + tables.join(' ');
        } catch (e) {
            return 'brak dostępu do iframe: ' + e.message;
        }
    }

    function loadInIframe(href) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            // trzymamy iframe "na ekranie", ale niewidoczny - app może nie renderować treści poza ekranem
            iframe.style.cssText = 'position:fixed;left:0;top:0;width:1400px;height:900px;border:0;opacity:0;pointer-events:none;z-index:-1;';
            iframe.src = href;

            const started = Date.now();
            let lastError = null;
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
                } catch (e) { lastError = e; }

                if (Date.now() - started > IFRAME_TIMEOUT_MS) {
                    clearInterval(timer);
                    const info = describeIframe(iframe) + (lastError ? ' | błąd parsera: ' + lastError.message : '');
                    iframe.remove();
                    reject(new Error('timeout: ' + info));
                }
            }, 500);

            document.body.appendChild(iframe);
        });
    }

    // undefined = jeszcze brak danych, null = dane są, ale bez liczby, number = suma
    function parseDetails(doc) {
        // 1. indeks kolumny Boxes – z nagłówka w DOWOLNEJ tabeli (nagłówek bywa w osobnej tabeli niż wiersze)
        let idx = -1;
        for (const th of doc.querySelectorAll('th')) {
            if (th.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'boxes') {
                idx = Array.prototype.indexOf.call(th.parentElement.children, th);
                break;
            }
        }
        if (idx === -1) return undefined;

        // 2. wiersze z pozycjami zamówienia
        let rows = Array.from(doc.querySelectorAll('[data-testid="shipment-sku-item-row"]'))
            .map(el => el.closest('tr'))
            .filter(Boolean);

        // awaryjnie: wszystkie wiersze tbody poza "Total"
        if (!rows.length) {
            rows = Array.from(doc.querySelectorAll('tbody tr')).filter(tr =>
                tr.children.length > idx && !/^total$/i.test(tr.children[0].textContent.trim()));
        }
        if (!rows.length) return undefined;

        let sum = 0, found = false;
        for (const tr of rows) {
            const cell = tr.children[idx];
            const m = cell ? cell.textContent.match(/\d+/) : null;
            if (m) { sum += parseInt(m[0], 10); found = true; }
        }
        if (!found) {
            console.warn(LOG, 'Znaleziono wiersze, ale bez liczby w kolumnie Boxes (idx=' + idx + '):',
                rows.map(tr => Array.from(tr.children).map(td => td.textContent.trim())));
        }
        return found ? sum : null;
    }

    // ---------- helpery DOM (bez innerHTML) ----------
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

    // ---------- modyfikacja strony ----------
    function processHeaders() {
        document.querySelectorAll('tr[data-testid="orders-table-header-row"]').forEach(headRow => {
            if (headRow.querySelector('th.sf-boxes-th')) return;
            const lastTh = headRow.querySelector('th:last-child');
            const th = makeCell('th', (lastTh ? lastTh.className : '') + ' sf-boxes-th', 'Boxes');
            th.setAttribute('scope', 'col');
            headRow.appendChild(th);
        });
    }

    function processRows() {
        document.querySelectorAll('tr[data-testid^="orders-table-row-"]').forEach(tr => {
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
            if (cached !== undefined) { show(cached); return; }

            const load = () => {
                setCell(td, '…');
                fetchBoxes(new URL(href, location.origin).href, key)
                    .then(val => {
                        cacheSet(key, val);
                        show(val);
                    })
                    .catch(err => {
                        console.warn(LOG, 'Błąd pobierania', key, err.message);
                        setCell(td, '?', 'Błąd: ' + err.message + ' (kliknij, aby ponowić)');
                        td.style.cursor = 'pointer';
                        td.onclick = () => { td.onclick = null; td.style.cursor = ''; load(); };
                    });
            };
            load();
        });
    }

    function safeProcess() {
        try { processHeaders(); processRows(); } catch (e) { console.error(LOG, e); }
    }

    let debounce = null;
    new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(safeProcess, 300);
    }).observe(document.body, { childList: true, subtree: true });

    setInterval(safeProcess, 1500);
    safeProcess();
    console.log(LOG, 'Skrypt Boxes uruchomiony v1.4');
})();

// ==UserScript==
// @name         Seller Flex - kolumna Boxes
// @namespace    kimcichon-beliani
// @version      1.6
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
    const DETAILS_URL = 'https://sellerflex.amazon.de/orders/details/';
    const WORKERS = 4;                 // ile iframe'ów pracuje równolegle
    const POLL_MS = 100;               // jak często sprawdzamy wynik
    const SPA_FALLBACK_MS = 5000;      // po tylu ms bez wyniku z nawigacji SPA robimy pełne przeładowanie
    const NO_BOXES_GRACE_MS = 2500;    // ID widać, a Boxes brak -> po tylu ms uznajemy "-"
    const TIMEOUT_MS = 15000;
    const IDLE_CLEANUP_MS = 15000;
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

    // ---------- parser szczegółów zamówienia ----------
    function hasDetailsHeader(doc) {
        for (const th of doc.querySelectorAll('th')) {
            const t = th.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
            if (t === 'sku' || t === 'order items') return true;
        }
        return false;
    }

    // undefined = jeszcze się ładuje
    // null      = zamówienie załadowane, ale brak kolumny/liczby Boxes  -> "-"
    // number    = suma Boxes
    function parseDetails(doc, id, state) {
        if (!doc.body || !doc.body.textContent.includes(id)) return undefined; // to jeszcze nie to zamówienie
        if (!state.idSeenAt) state.idSeenAt = Date.now();
        const graceOver = Date.now() - state.idSeenAt > NO_BOXES_GRACE_MS;

        let idx = -1;
        for (const th of doc.querySelectorAll('th')) {
            if (th.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'boxes') {
                idx = Array.prototype.indexOf.call(th.parentElement.children, th);
                break;
            }
        }

        if (idx === -1) {
            // pozycje zamówienia są, a kolumny Boxes brak -> od razu "-"
            const loaded = doc.querySelector('[data-testid="shipment-sku-item-row"]') || hasDetailsHeader(doc);
            if (loaded || graceOver) return null;
            return undefined;
        }

        let rows = Array.from(doc.querySelectorAll('[data-testid="shipment-sku-item-row"]'))
            .map(el => el.closest('tr'))
            .filter(Boolean);
        if (!rows.length) {
            rows = Array.from(doc.querySelectorAll('tbody tr')).filter(tr =>
                tr.children.length > idx && !/^total$/i.test(tr.children[0].textContent.trim()));
        }
        if (!rows.length) return graceOver ? null : undefined;

        let sum = 0, found = false;
        for (const tr of rows) {
            const cell = tr.children[idx];
            const m = cell ? cell.textContent.match(/\d+/) : null;
            if (m) { sum += parseInt(m[0], 10); found = true; }
        }
        return found ? sum : null;
    }

    // ---------- pula iframe'ów ----------
    const queue = [];
    const workers = [];
    const inFlight = new Map();
    let idleTimer = null;

    function createWorker() {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:0;top:0;width:1400px;height:900px;border:0;opacity:0;pointer-events:none;z-index:-1;';
        document.body.appendChild(iframe);
        return { iframe, busy: false, ready: false };
    }

    function hardLoad(w, url) {
        w.ready = false;
        try { w.iframe.contentWindow.location.replace(url); }
        catch (e) { w.iframe.src = url; }
    }

    function runJob(w, job) {
        return new Promise((resolve, reject) => {
            const url = DETAILS_URL + job.id;
            const path = '/orders/details/' + job.id;
            const started = Date.now();
            const state = { idSeenAt: 0 };
            let spaTried = false;
            let lastError = null;

            if (w.ready) {
                try {
                    const win = w.iframe.contentWindow;
                    win.history.pushState({}, '', path);
                    win.dispatchEvent(new win.PopStateEvent('popstate', { state: {} }));
                    spaTried = true;
                } catch (e) { hardLoad(w, url); }
            } else {
                w.iframe.src = url;
            }

            const timer = setInterval(() => {
                try {
                    const doc = w.iframe.contentDocument;
                    if (doc) {
                        const r = parseDetails(doc, job.id, state);
                        if (r !== undefined) {
                            clearInterval(timer);
                            w.ready = true;
                            resolve(r);
                            return;
                        }
                    }
                } catch (e) { lastError = e; }

                const elapsed = Date.now() - started;
                if (spaTried && !state.idSeenAt && elapsed > SPA_FALLBACK_MS) {
                    spaTried = false;
                    hardLoad(w, url);
                }
                if (elapsed > TIMEOUT_MS) {
                    clearInterval(timer);
                    w.ready = false;
                    // strona zamówienia się załadowała (widać ID), tylko bez Boxes -> "-"
                    if (state.idSeenAt) { resolve(null); return; }
                    reject(new Error('strona zamówienia nie załadowała się (' + job.id + ')' +
                        (lastError ? ' | ' + lastError.message : '')));
                }
            }, POLL_MS);
        });
    }

    function processQueue() {
        while (queue.length) {
            let w = workers.find(x => !x.busy);
            if (!w && workers.length < WORKERS) {
                w = createWorker();
                workers.push(w);
            }
            if (!w) return;
            const job = queue.shift();
            w.busy = true;
            runJob(w, job)
                .then(job.resolve, job.reject)
                .finally(() => {
                    w.busy = false;
                    processQueue();
                    scheduleCleanup();
                });
        }
    }

    function scheduleCleanup() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (!queue.length && workers.every(w => !w.busy)) {
                workers.forEach(w => w.iframe.remove());
                workers.length = 0;
            }
        }, IDLE_CLEANUP_MS);
    }

    function fetchBoxes(id) {
        if (inFlight.has(id)) return inFlight.get(id);
        const p = new Promise((resolve, reject) => {
            queue.push({ id, resolve, reject });
            processQueue();
        });
        inFlight.set(id, p);
        const clear = () => inFlight.delete(id);
        p.then(clear, clear);
        return p;
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

    // ID wysyłki z <p data-testid="shipment-id-text">Shipment ID: XXXX</p> (awaryjnie z href)
    function getShipmentId(tr) {
        const p = tr.querySelector('[data-testid="shipment-id-text"]');
        if (p) {
            const id = p.textContent.replace(/^\s*Shipment ID:\s*/i, '').trim();
            if (id) return id;
        }
        const link = tr.querySelector('a[data-testid="single-order-details-link"]');
        const m = link && link.getAttribute('href').match(/\/orders\/details\/([^/?#]+)/);
        return m ? m[1] : null;
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

            const id = getShipmentId(tr);
            if (!id) return;

            const lastTd = tr.querySelector('td:last-child');
            const td = makeCell('td', (lastTd ? lastTd.className : '') + ' sf-boxes-td', '…');
            tr.appendChild(td);

            const show = val => setCell(td, val === null ? '-' : String(val));

            const cached = cacheGet(id);
            if (cached !== undefined) { show(cached); return; }

            const load = () => {
                setCell(td, '…');
                fetchBoxes(id)
                    .then(val => {
                        cacheSet(id, val);
                        show(val);
                    })
                    .catch(err => {
                        console.warn(LOG, 'Błąd pobierania', id, err.message);
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
    console.log(LOG, 'Skrypt Boxes uruchomiony v1.6');
})();

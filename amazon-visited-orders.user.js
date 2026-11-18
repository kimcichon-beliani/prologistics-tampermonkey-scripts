// ==UserScript==
// @name         Amazon SC – odwiedzone zamówienia na zielono
// @namespace    beliani-kim
// @version      1.0
// @description  Zapamiętuje lokalnie, w które zamówienia się weszło, i koloruje ich numery na zielono na liście zamówień.
// @author       kimrioter
// @updateURL    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/main/amazon-visited-orders.user.js
// @downloadURL  https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/main/amazon-visited-orders.user.js
// @match        https://sellercentral-europe.amazon.com/*
// @match        https://sellercentral.amazon.de/*
// @match        https://sellercentral.amazon.co.uk/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORE_KEY = 'visitedOrders';
    const GREEN = '#1a8f2e';
    const ORDER_RE = /\b\d{3}-\d{7}-\d{7}\b/;
    const MAX_AGE_DAYS = 90; // starsze wpisy są czyszczone

    // ---------- pamięć ----------
    function load() {
        const data = GM_getValue(STORE_KEY, {});
        return (data && typeof data === 'object') ? data : {};
    }
    let visited = load();

    function save() {
        const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
        for (const id in visited) if (visited[id] < cutoff) delete visited[id];
        GM_setValue(STORE_KEY, visited);
    }

    function markVisited(id) {
        if (!id || visited[id]) return;
        visited[id] = Date.now();
        save();
        paint();
    }

    // zmiany z innych kart (np. zamówienie otwarte w nowej karcie)
    GM_addValueChangeListener(STORE_KEY, (_k, _old, newVal, remote) => {
        if (remote) { visited = newVal || {}; paint(); }
    });

    // ---------- styl ----------
    const style = document.createElement('style');
    style.textContent = `
        .kim-visited-order, .kim-visited-order * {
            color: ${GREEN} !important;
        }
        .kim-visited-order { font-weight: 600; }
    `;
    document.head.appendChild(style);

    // ---------- wykrywanie, że jesteśmy w zamówieniu ----------
    function orderIdFromUrl(url) {
        const m = url.match(/\/orders-v3\/order\/(\d{3}-\d{7}-\d{7})/);
        return m ? m[1] : null;
    }

    let lastUrl = '';
    function checkUrl() {
        if (location.href === lastUrl) return;
        lastUrl = location.href;
        markVisited(orderIdFromUrl(location.href));
    }

    // ---------- kolorowanie linków ----------
    function getOrderIdForLink(a) {
        const fromHref = orderIdFromUrl(a.getAttribute('href') || '');
        if (fromHref) return fromHref;
        const m = (a.textContent || '').match(ORDER_RE);
        return m ? m[0] : null;
    }

    function paint() {
        document.querySelectorAll('a').forEach(a => {
            const id = getOrderIdForLink(a);
            if (!id) return;
            a.dataset.kimOrderId = id;
            a.classList.toggle('kim-visited-order', !!visited[id]);
        });
    }

    // klik w link (także środkowym przyciskiem / Ctrl+klik → nowa karta)
    function onClick(e) {
        const a = e.target.closest && e.target.closest('a');
        if (!a) return;
        const id = a.dataset.kimOrderId || getOrderIdForLink(a);
        if (id) markVisited(id);
    }
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);

    // ---------- SPA: lista ładuje się dynamicznie ----------
    let scheduled = false;
    new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => { scheduled = false; checkUrl(); paint(); }, 200);
    }).observe(document.body, { childList: true, subtree: true });

    setInterval(checkUrl, 1000);

    // ---------- menu Tampermonkey ----------
    GM_registerMenuCommand('Wyczyść odwiedzone zamówienia', () => {
        if (!confirm('Usunąć zapamiętane odwiedzone zamówienia?')) return;
        visited = {};
        save();
        paint();
    });
    GM_registerMenuCommand('Pokaż liczbę zapamiętanych', () => {
        alert('Zapamiętanych zamówień: ' + Object.keys(visited).length);
    });

    checkUrl();
    paint();
})();

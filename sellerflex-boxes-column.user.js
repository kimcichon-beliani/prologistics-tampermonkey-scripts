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
            iframe.src =

// ==UserScript==
// @name         Prologistics RMA – View log pod kodem kreskowym + ostatnia aktywność
// @namespace    kimrioter
// @version      1.0.0
// @description  Kopiuje przycisk "Show all" z View log pod kod kreskowy ticketu (na środku) i pokazuje ostatnią aktywność z logu
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-view-log-last-activity.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-view-log-last-activity.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG_PREFIX = '[TM script by kimrioter]';
    const BRAND_COLOR = '#750000';
    const BOX_ID = 'tm-rma-viewlog-box';
    const AUTO_LOAD = true; // automatycznie kliknij oryginalny "Show all", żeby pobrać log i pokazać ostatnią aktywność

    let autoLoaded = false;
    let originalBtn = null;

    // --- Znajdź kod kreskowy ticketu ---
    function findBarcode() {
        return document.querySelector('img[src*="barcode.php"][alt^="Ticket"]')
            || document.querySelector('img[src*="barcode.php"]');
    }

    // --- Znajdź tabelę View log ---
    function findLogTable() {
        const ths = document.querySelectorAll('th');
        for (const th of ths) {
            if (th.closest('#' + BOX_ID)) continue;
            if (/^\s*View log\s*$/i.test(th.firstChild ? th.firstChild.textContent : th.textContent) ||
                /^\s*View log/i.test(th.textContent)) {
                return th.closest('table');
            }
        }
        return null;
    }

    // --- Oryginalny przycisk "Show all" ---
    function findOriginalButton(table) {
        if (!table) return null;
        return table.querySelector('input[type="button"][onclick*="get_page_log"]');
    }

    // --- Ostatnia aktywność z tabeli logu ---
    function getLastActivity(table) {
        if (!table) return null;
        let best = null;
        table.querySelectorAll('tr').forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length < 2) return;
            const date = tds[tds.length - 1].textContent.trim();
            if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) return;
            const user = tds[0].textContent.trim();
            if (!best || date > best.date) best = { user, date };
        });
        return best;
    }

    // --- Zbuduj / zaktualizuj box pod kodem kreskowym ---
    function ensureBox(barcode) {
        let box = document.getElementById(BOX_ID);
        if (box) return box;

        box = document.createElement('div');
        box.id = BOX_ID;
        box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;margin:8px auto 12px auto;text-align:center;';

        const btn = document.createElement('input');
        btn.type = 'button';
        btn.value = 'Show all';
        btn.id = BOX_ID + '-btn';
        btn.title = 'View log – pokaż cały log';
        btn.style.cssText = 'cursor:pointer;';
        btn.addEventListener('click', () => {
            const table = findLogTable();
            const orig = findOriginalButton(table) || originalBtn;
            if (orig && document.body.contains(orig)) {
                orig.click();
            } else if (table) {
                // log już załadowany – przewiń do niego
                table.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        const info = document.createElement('div');
        info.id = BOX_ID + '-info';
        info.style.cssText = 'font-size:13px;color:#333;';
        info.textContent = 'Ostatnia aktywność: ładowanie…';

        box.appendChild(btn);
        box.appendChild(info);
        barcode.insertAdjacentElement('afterend', box);
        return box;
    }

    function renderInfo(text, isEmpty) {
        const info = document.getElementById(BOX_ID + '-info');
        if (!info) return;
        if (info.dataset.value === text) return; // unikamy zbędnych mutacji
        info.dataset.value = text;
        info.innerHTML = '';
        const label = document.createElement('span');
        label.textContent = 'Ostatnia aktywność: ';
        info.appendChild(label);
        const val = document.createElement('strong');
        val.textContent = text;
        if (!isEmpty) val.style.color = BRAND_COLOR;
        info.appendChild(val);
    }

    function update() {
        const barcode = findBarcode();
        if (!barcode) return;
        ensureBox(barcode);

        const table = findLogTable();
        const btn = findOriginalButton(table);
        if (btn) originalBtn = btn;

        // automatyczne załadowanie logu (raz)
        if (AUTO_LOAD && !autoLoaded && btn) {
            autoLoaded = true;
            console.log(LOG_PREFIX, 'Auto-ładowanie View log');
            btn.click();
            return;
        }

        const last = getLastActivity(table);
        if (last) {
            renderInfo(`${last.user} – ${last.date}`, false);
        } else if (!btn) {
            renderInfo('brak wpisów', true);
        }
    }

    // --- Debounce dla MutationObserver ---
    let timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(update, 150);
    }

    update();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });

    console.log(LOG_PREFIX, 'rma-view-log-last-activity v1.0.0 uruchomiony');
})();

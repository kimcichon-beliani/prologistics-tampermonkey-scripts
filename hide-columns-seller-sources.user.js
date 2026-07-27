// ==UserScript==
// @name         Ukrywanie kolumn — Source sellers
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Domyślnie chowa wybrane, niepotrzebne kolumny w tabeli na stronie seller_sources.php
// @author       kimrioter
// @match        https://www.prologistics.info/seller_sources.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM hide columns script by kimrioter] Start');

    // Numery kolumn do ukrycia (liczone od 0, zgodnie z atrybutem data-column w nagłówku tabeli)
    const COLUMNS_TO_HIDE = new Set([9, 10, 11, 13, 15, 16, 17, 19, 20, 22, 23, 24, 25]);

    function hideColumns() {
        const headerRow = document.getElementById('tableHead');
        if (!headerRow) return false;

        const table = headerRow.closest('table');
        if (!table) return false;

        const headerCells = Array.from(headerRow.children).filter(el => el.tagName === 'TH');
        headerCells.forEach((th, idx) => {
            if (COLUMNS_TO_HIDE.has(idx)) {
                th.style.display = 'none';
            }
        });

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = Array.from(row.children);
            COLUMNS_TO_HIDE.forEach(idx => {
                if (cells[idx]) cells[idx].style.display = 'none';
            });
        });

        console.log('[TM hide columns script by kimrioter] Ukryto kolumn:', COLUMNS_TO_HIDE.size, '| Wierszy:', rows.length);
        return true;
    }

    hideColumns();

    // Na wypadek, gdyby tabela doładowywała się z opóźnieniem albo odświeżała po filtrowaniu
    const observer = new MutationObserver(() => {
        hideColumns();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM hide columns script by kimrioter] Zainicjalizowano observer');
})();

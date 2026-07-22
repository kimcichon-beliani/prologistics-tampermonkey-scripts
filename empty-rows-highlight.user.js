// ==UserScript==
// @name         Podświetlanie pustych wierszy — Mark as shipped / No labels found
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Zaznacza wiersze z pustym "Mark as shipped" oraz z "No labels found"
// @author       kimrioter
// @match        https://www.prologistics.info/search.php*
// @match        https://www.prologistics.info/total_cycle_time.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Autor: kimrioter
// Reguła 1: tabela "Total Cycle Time" — podświetla wiersz, gdy "Mark as shipped" jest puste
// Reguła 2: tabela wysyłkowa — podświetla wiersz, gdy w kolumnie "Shipping labels" jest tekst "No labels found"

(function () {
    'use strict';
    console.log('[TM script by kimrioter] Start');

    const CLASS_MARK_AS_SHIPPED = 'tm-empty-shipped-row';
    const CLASS_NO_LABELS = 'tm-no-labels-row';

    const style = document.createElement('style');
    style.textContent = `
        tr.${CLASS_MARK_AS_SHIPPED} td {
            background-color: #f6ada4 !important;
        }
        tr.${CLASS_NO_LABELS} td {
            background-color: #EA7B7B !important;
        }
    `;
    document.head.appendChild(style);

    function highlightMarkAsShipped() {
        const rows = document.querySelectorAll('tr.order-row');
        let highlighted = 0;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            const targetCell = cells[cells.length - 3];
            const isEmpty = targetCell.textContent.trim() === '';

            row.classList.toggle(CLASS_MARK_AS_SHIPPED, isEmpty);
            if (isEmpty) highlighted++;
        });

        if (rows.length > 0) {
            console.log('[TM script by kimrioter] Mark as shipped — wierszy:', rows.length, '| Pustych:', highlighted);
        }
    }

    function highlightNoLabelsFound() {
        const rows = document.querySelectorAll('tr.result-item');
        let highlighted = 0;

        rows.forEach(row => {
            const hasNoLabels = Array.from(row.querySelectorAll('td')).some(
                td => td.textContent.trim() === 'No labels found'
            );

            row.classList.toggle(CLASS_NO_LABELS, hasNoLabels);
            if (hasNoLabels) highlighted++;
        });

        if (rows.length > 0) {
            console.log('[TM script by kimrioter] No labels found — wierszy:', rows.length, '| Podświetlonych:', highlighted);
        }
    }

    function runAll() {
        highlightMarkAsShipped();
        highlightNoLabelsFound();
    }

    runAll();
    setInterval(runAll, 1000);

    const observer = new MutationObserver(() => runAll());
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM script by kimrioter] Zainicjalizowano observer i interval');
})();

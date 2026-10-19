// ==UserScript==
// @name         Import tool - kolejne numery w Row #
// @namespace    prologistics
// @version      1.1
// @description  Numeruje kolumnę "Row #" na liście importowanych zamówień kolejno od 1 (nagłówek bez zmian)
// @author       kimrioter
// @match        https://www.prologistics.info/react/settings_page/import_tool/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/import-tool-row-renumber.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/import-tool-row-renumber.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const HEADER_TEXT = 'Row #';

    function renumber() {
        document.querySelectorAll('table.MuiTable-root').forEach(table => {
            // znajdź kolumnę "Row #" po nagłówku
            const headerCell = [...table.querySelectorAll('th')]
                .find(th => th.textContent.trim() === HEADER_TEXT);
            if (!headerCell) return;

            const colIdx = [...headerCell.parentElement.children].indexOf(headerCell);
            if (colIdx === -1) return;

            let counter = 0;
            table.querySelectorAll('tr').forEach(tr => {
                // pomijamy wiersze nagłówkowe
                if (tr.querySelector('th')) return;

                const td = tr.children[colIdx];
                if (!td || td.tagName !== 'TD') return;

                const current = td.textContent.trim();
                if (current === HEADER_TEXT) return;
                if (!/^\d+$/.test(current)) return;

                counter++;
                const newNum = String(counter);
                if (current === newNum) return;

                // zmieniamy tylko wartość węzła tekstowego, żeby nie psuć renderowania Reacta
                if (td.firstChild && td.firstChild.nodeType === Node.TEXT_NODE) {
                    td.firstChild.nodeValue = newNum;
                } else {
                    td.textContent = newNum;
                }
                td.title = 'Oryginalny numer wiersza: ' + current;
            });
        });
    }

    let scheduled = false;
    function scheduleRenumber() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            renumber();
        });
    }

    new MutationObserver(scheduleRenumber).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    scheduleRenumber();
    console.log(LOG, 'Row # renumbering aktywne');
})();

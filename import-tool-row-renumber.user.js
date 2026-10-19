// ==UserScript==
// @name         Import tool - kolejne numery w Row #
// @namespace    prologistics
// @version      1.0
// @description  Numeruje kolumnę "Row #" na liście importowanych zamówień kolejno od 1
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
            const headers = [...table.querySelectorAll('thead th')];
            const colIdx = headers.findIndex(th => th.textContent.trim() === HEADER_TEXT);
            if (colIdx === -1) return;

            table.querySelectorAll('tbody tr').forEach((tr, i) => {
                const td = tr.children[colIdx];
                if (!td) return;

                const newNum = String(i + 1);
                const current = td.textContent.trim();
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

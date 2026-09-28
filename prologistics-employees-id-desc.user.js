// ==UserScript==
// @name         Prologistics – Employees: ID od najnowszego
// @namespace    kimrioter
// @version      1.0
// @description  Na stronie Employees zawsze ustawia sortowanie po ID malejąco (od najnowszego do najstarszego)
// @author       kimrioter
// @match        https://www.prologistics.info/react/settings_page/employees*
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-employees-id-desc.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-employees-id-desc.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const ASC = /[▲↑]/;
    const DESC = /[▼↓]/;
    const MAX_ATTEMPTS = 3; // zabezpieczenie przed nieskończonym klikaniem

    let busy = false;
    let attempts = 0;
    let debounceTimer = null;

    // Szuka nagłówka kolumny "ID" (z ewentualną strzałką sortowania)
    function findIdHeader() {
        const ths = document.querySelectorAll('table th');
        for (const th of ths) {
            const txt = th.textContent.replace(/\s+/g, ' ').trim();
            if (/^ID\s*[▲▼↑↓]?$/.test(txt)) return th;
        }
        return null;
    }

    // Odczytuje aktualny stan sortowania kolumny ID
    function getState(th) {
        const txt = th.textContent;
        if (DESC.test(txt)) return 'desc';
        if (ASC.test(txt)) return 'asc';
        const aria = th.getAttribute('aria-sort');
        if (aria === 'descending') return 'desc';
        if (aria === 'ascending') return 'asc';
        return 'none';
    }

    // Klika najgłębszy element z tekstem "ID" – event i tak "bąbelkuje" w górę do <th>
    function clickHeader(th) {
        let el = th;
        while (el.firstElementChild && el.firstElementChild.textContent.includes('ID')) {
            el = el.firstElementChild;
        }
        el.click();
    }

    function enforceDesc() {
        if (busy) return;
        const th = findIdHeader();
        if (!th) return;

        const state = getState(th);

        if (state === 'desc') {
            attempts = 0;
            return;
        }

        // 'none' przy attempts === 0 oznacza, że użytkownik posortował inną kolumnę – nie ruszamy.
        // 'none' przy attempts > 0 oznacza, że nasz klik przestawił na "bez sortowania" – klikamy dalej.
        if (state === 'asc' || (state === 'none' && attempts > 0)) {
            if (attempts >= MAX_ATTEMPTS) {
                console.warn(`${LOG} Nie udało się ustawić sortowania malejącego po ${MAX_ATTEMPTS} próbach.`);
                return;
            }
            attempts++;
            busy = true;
            clickHeader(th);
            console.log(`${LOG} Przełączam sortowanie ID na malejące (próba ${attempts}).`);
            setTimeout(() => {
                busy = false;
                enforceDesc();
            }, 300);
        }
    }

    // Obserwujemy zmiany w DOM (ładowanie tabeli, kliknięcie "Filter", przejścia w SPA)
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(enforceDesc, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    enforceDesc();
})();

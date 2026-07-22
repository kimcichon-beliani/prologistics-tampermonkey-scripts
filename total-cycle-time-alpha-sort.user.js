// ==UserScript==
// @name         Sortowanie list wyboru alfabetycznie — Total Cycle Time
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Sortuje alfabetycznie opcje w listach wielokrotnego wyboru, z "All" zawsze na górze
// @author       kimrioter
// @match        https://www.prologistics.info/total_cycle_time.php*
// @run-at       document-idle
// @grant        none
// @updateURL https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/refs/heads/main/total-cycle-time-alpha-sort.user.js
// @downloadURL https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/refs/heads/main/total-cycle-time-alpha-sort.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM sort script by kimrioter] Start');

    let isSorting = false;
    let debounceTimer = null;

    function sortSelectOptions(select) {
        const options = Array.from(select.options);
        if (options.length < 2) return false;

        const allOption = options.find(o => o.value.trim() === 'All' || o.text.trim() === 'All');
        const rest = options.filter(o => o !== allOption);

        rest.sort((a, b) => a.text.trim().localeCompare(b.text.trim(), 'pl', { sensitivity: 'base' }));

        const newOrder = allOption ? [allOption, ...rest] : rest;

        let alreadySorted = true;
        for (let i = 0; i < newOrder.length; i++) {
            if (options[i] !== newOrder[i]) { alreadySorted = false; break; }
        }
        if (alreadySorted) return false;

        newOrder.forEach(o => select.appendChild(o));
        return true;
    }

    function sortAllLists() {
        if (isSorting) return;
        isSorting = true;

        let changedAny = false;
        document.querySelectorAll('select[multiple]').forEach(select => {
            if (sortSelectOptions(select)) changedAny = true;
        });

        isSorting = false;
        return changedAny;
    }

    sortAllLists();

    // Debounce: czekamy chwilę po ostatniej zmianie w DOM, zanim ponownie sprawdzimy listy —
    // dzięki temu nie sortujemy przy każdej pojedynczej mikro-zmianie, tylko raz po "uspokojeniu się" strony
    const observer = new MutationObserver(() => {
        if (isSorting) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(sortAllLists, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM sort script by kimrioter] Zainicjalizowano observer (z debounce)');
})();

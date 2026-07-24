// ==UserScript==
// @name         Sortowanie listy Sellers — Calculations
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Sortuje alfabetycznie listę checkboxów "Sellers" na stronie calcs.php
// @author       kimrioter
// @match        https://www.prologistics.info/calcs.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM sellers sort script by kimrioter] Start');

    function isCheckbox(node) {
        return node.nodeType === 1 && node.tagName === 'INPUT' &&
               node.type === 'checkbox' && node.name === 'username[]';
    }

    function isHiddenInput(node) {
        return node.nodeType === 1 && node.tagName === 'INPUT' && node.type === 'hidden';
    }

    function sortSellersList() {
        // Znajdujemy kontener po stabilnym <select id="seller_country_code">,
        // bo sam <td> nie ma żadnego id/klasy do namierzenia
        const countrySelect = document.getElementById('seller_country_code');
        if (!countrySelect) return false;

        const td = countrySelect.closest('td');
        if (!td) return false;

        if (td.dataset.tmSorted === 'true') return false; // już posortowane, nie robimy tego drugi raz

        const nodes = Array.from(td.childNodes);

        // Wszystko przed pierwszym checkboxem (nagłówek "Sellers", dwa <select>) zostaje na górze bez zmian
        let i = 0;
        while (i < nodes.length && !isCheckbox(nodes[i])) i++;
        const headNodes = nodes.slice(0, i);

        // Grupujemy: [checkbox, tekst etykiety, <br>, hidden input] jako jedna logiczna pozycja
        const groups = [];
        let idx = i;
        while (idx < nodes.length) {
            if (!isCheckbox(nodes[idx])) { idx++; continue; }
            const groupNodes = [nodes[idx]];
            let j = idx + 1;
            while (j < nodes.length && !isCheckbox(nodes[j])) {
                groupNodes.push(nodes[j]);
                const wasHidden = isHiddenInput(nodes[j]);
                j++;
                if (wasHidden) break;
            }
            const label = groupNodes
                .filter(n => n.nodeType === 3)
                .map(n => n.textContent)
                .join('')
                .trim();
            groups.push({ label, nodes: groupNodes });
            idx = j;
        }

        // Wszystko, co zostało po ostatniej grupie (np. końcowy <br>), zostaje na dole bez zmian
        const tailNodes = nodes.slice(idx);

        if (groups.length === 0) return false;

        // Sortujemy grupy alfabetycznie po pełnej etykiecie
        groups.sort((a, b) => a.label.localeCompare(b.label, 'pl', { sensitivity: 'base' }));

        // Odbudowujemy kolejność: nagłówek → posortowane pozycje → to co było na końcu
        headNodes.forEach(n => td.appendChild(n));
        groups.forEach(g => g.nodes.forEach(n => td.appendChild(n)));
        tailNodes.forEach(n => td.appendChild(n));

        td.dataset.tmSorted = 'true';
        console.log('[TM sellers sort script by kimrioter] Posortowano pozycji:', groups.length);
        return true;
    }

    sortSellersList();

    // Na wypadek, gdyby lista ładowała się z opóźnieniem (np. przez AJAX)
    const observer = new MutationObserver(() => {
        const countrySelect = document.getElementById('seller_country_code');
        if (countrySelect) {
            const td = countrySelect.closest('td');
            if (td && td.dataset.tmSorted !== 'true') {
                sortSellersList();
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM sellers sort script by kimrioter] Zainicjalizowano observer');
})();

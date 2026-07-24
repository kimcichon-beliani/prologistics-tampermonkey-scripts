// ==UserScript==
// @name         Sortowanie list Sellers + Source seller — Calculations
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Sortuje alfabetycznie listę "Sellers" oraz wszystkie listy "Source seller" (dla każdego sellera) na stronie calcs.php
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

    function isSourceSellerItem(node) {
        return node.nodeType === 1 && node.classList && node.classList.contains('source-seller-item');
    }

    let sourceSellerHooked = false;
    const itemPlaceholders = new Map(); // pozycja -> znacznik jej prawdziwego, oryginalnego miejsca w DOM
    let mergeContainer = null;

    // Zapamiętujemy PRAWDZIWE, oryginalne miejsce każdej pozycji (przed jakąkolwiek naszą ingerencją) —
    // niewidoczny znacznik (komentarz) pozwala w każdej chwili wrócić dokładnie tam, skąd dana pozycja pochodzi
    function recordOriginalPositions() {
        document.querySelectorAll('.source-seller-item').forEach(item => {
            const placeholder = document.createComment('tm-item-placeholder');
            item.parentNode.insertBefore(placeholder, item);
            itemPlaceholders.set(item, placeholder);
        });
    }

    // Przywraca WSZYSTKIE pozycje na ich prawdziwe miejsce — MUSI się to dziać zanim strona
    // sama policzy widoczność (closest()/:visible), bo ta logika wymaga prawdziwej struktury DOM
    function restoreAllItemsToOriginalPosition() {
        itemPlaceholders.forEach((placeholder, item) => {
            if (placeholder.parentNode) {
                placeholder.parentNode.insertBefore(item, placeholder.nextSibling);
            }
        });
    }

    function isItemVisible(item) {
        return item.offsetParent !== null;
    }

    function ensureMergeContainer() {
        if (mergeContainer && mergeContainer.isConnected) return mergeContainer;
        const firstItem = itemPlaceholders.keys().next().value;
        if (!firstItem) return null;
        const firstPlaceholder = itemPlaceholders.get(firstItem);
        mergeContainer = document.createElement('div');
        mergeContainer.className = 'tm-merged-source-sellers';
        firstPlaceholder.parentNode.insertBefore(mergeContainer, firstPlaceholder);
        return mergeContainer;
    }

    // Po tym, jak strona POPRAWNIE obliczy, co powinno być widoczne (na prawdziwej strukturze),
    // zbieramy WSZYSTKIE aktualnie widoczne pozycje (niezależnie z którego sellera) i wyświetlamy
    // je razem, w jednej wspólnej, alfabetycznej kolejności
    function mergeVisibleItemsIntoSortedView() {
        const container = ensureMergeContainer();
        if (!container) return;

        const items = Array.from(itemPlaceholders.keys());
        const visibleItems = items.filter(isItemVisible);

        const noSource = visibleItems.find(el => el.textContent.trim() === 'No source assigned');
        const rest = visibleItems.filter(el => el !== noSource);
        rest.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim(), 'pl', { sensitivity: 'base' }));

        if (noSource) container.appendChild(noSource);
        rest.forEach(el => container.appendChild(el));

        console.log('[TM sellers sort script by kimrioter] Widocznych pozycji Source seller (połączonych):', visibleItems.length);
    }

    // "Otaczamy" moment kliknięcia/zmiany: nasłuchujemy w fazie PRZECHWYTYWANIA (uruchamia się
    // PRZED tym, jak strona sama policzy widoczność), żeby przywrócić prawdziwą strukturę,
    // a potem w normalnej fazie (uruchamia się PO), żeby połączyć i posortować wynik.
    // To działa niezależnie od tego, jak strona wewnętrznie deklaruje swoją funkcję.
    function isRelevantTrigger(target) {
        if (!target || target.nodeType !== 1) return false;
        if (target.matches('input[type="checkbox"][name="username[]"]')) return true;
        if (target.id === 'source_seller_status' || target.id === 'source_seller_group') return true;
        return false;
    }

    function setupSourceSellerHook() {
        if (sourceSellerHooked) return;
        const anyItem = document.querySelector('.source-seller-item');
        if (!anyItem) return; // strona jeszcze nie wyrenderowała listy — spróbujemy ponownie

        sourceSellerHooked = true;
        console.log('[TM sellers sort script by kimrioter] Podpinam nasłuchiwanie zmian widoczności Source seller');

        recordOriginalPositions();

        document.addEventListener('click', (e) => {
            if (isRelevantTrigger(e.target)) restoreAllItemsToOriginalPosition();
        }, true); // faza przechwytywania — przed oryginalnym onclick

        document.addEventListener('click', (e) => {
            if (isRelevantTrigger(e.target)) mergeVisibleItemsIntoSortedView();
        }, false); // normalna faza — po oryginalnym onclick

        document.addEventListener('change', (e) => {
            if (isRelevantTrigger(e.target)) restoreAllItemsToOriginalPosition();
        }, true);

        document.addEventListener('change', (e) => {
            if (isRelevantTrigger(e.target)) mergeVisibleItemsIntoSortedView();
        }, false);

        // Pokazujemy połączony, posortowany widok od razu, na podstawie stanu obliczonego
        // już przez stronę przy pierwszym załadowaniu
        mergeVisibleItemsIntoSortedView();
    }

    sortSellersList();
    setupSourceSellerHook();

    // Na wypadek, gdyby lista Sellers lub funkcja showHideSources ładowały się z opóźnieniem
    const observer = new MutationObserver(() => {
        const countrySelect = document.getElementById('seller_country_code');
        if (countrySelect) {
            const td = countrySelect.closest('td');
            if (td && td.dataset.tmSorted !== 'true') {
                sortSellersList();
            }
        }
        setupSourceSellerHook();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM sellers sort script by kimrioter] Zainicjalizowano observer');
})();

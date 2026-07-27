// ==UserScript==
// @name         Ukrywanie kolumn — Source sellers
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  Panel z checkboxami do włączania/wyłączania widoczności kolumn tabeli na stronie seller_sources.php
// @author       kimrioter
// @match        https://www.prologistics.info/seller_sources.php*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/hide-columns-seller-sources.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/hide-columns-seller-sources.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM hide columns script by kimrioter] Start');

    const STORAGE_KEY = 'tm_hidden_columns_seller_sources';
    // Domyślnie ukryte kolumny (liczone od 0) — używane tylko przy pierwszej wizycie,
    // później decyduje to, co zapisane w pamięci przeglądarki
    const DEFAULT_HIDDEN = [9, 10, 11, 13, 15, 16, 17, 19, 20, 22, 23, 24, 25];

    let hiddenColumns = null;
    let initialized = false;
    let debounceTimer = null;

    function loadHiddenColumns() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { return new Set(JSON.parse(saved)); } catch (e) { /* ignore, fall through */ }
        }
        return new Set(DEFAULT_HIDDEN);
    }

    function saveHiddenColumns() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hiddenColumns)));
    }

    function getHeaderCells(headerRow) {
        return Array.from(headerRow.children).filter(el => el.tagName === 'TH');
    }

    function applyColumnVisibility() {
        const headerRow = document.getElementById('tableHead');
        if (!headerRow) return;
        const table = headerRow.closest('table');
        if (!table) return;

        const headerCells = getHeaderCells(headerRow);
        headerCells.forEach((th, idx) => {
            th.style.display = hiddenColumns.has(idx) ? 'none' : '';
        });

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = Array.from(row.children);
            headerCells.forEach((th, idx) => {
                if (cells[idx]) cells[idx].style.display = hiddenColumns.has(idx) ? 'none' : '';
            });
        });
    }

    function buildPanel(headerCells) {
        if (document.getElementById('tm-column-filter-panel')) return;

        const style = document.createElement('style');
        style.textContent = `
            .tm-column-filter-wrapper {
                position: relative;
                display: block;
                margin: 8px 0;
            }
            #tm-column-filter-toggle {
                cursor: pointer;
                border: 1px solid #ccc;
                background: #f4f4f4;
                border-radius: 4px;
                padding: 6px 10px;
                font-size: 13px;
                font-family: Arial, sans-serif;
            }
            #tm-column-filter-toggle:hover {
                background: #e6e6e6;
            }
            #tm-column-filter-panel {
                position: absolute;
                top: 100%;
                left: 0;
                margin-top: 4px;
                z-index: 9999;
                width: 320px;
                max-height: 70vh;
                overflow-y: auto;
                background: #ffffff;
                border: 1px solid #ccc;
                border-radius: 6px;
                box-shadow: 2px 2px 10px rgba(0,0,0,0.15);
                padding: 10px;
                font-family: Arial, sans-serif;
                font-size: 13px;
            }
            #tm-column-filter-panel .tm-title {
                font-weight: bold;
                margin-bottom: 8px;
            }
            #tm-column-filter-panel .tm-actions {
                margin-bottom: 8px;
                display: flex;
                gap: 8px;
            }
            #tm-column-filter-panel .tm-actions button {
                font-size: 12px;
                padding: 3px 8px;
                cursor: pointer;
            }
            .tm-column-filter-row {
                display: block;
                padding: 3px 0;
                cursor: pointer;
            }
            .tm-column-filter-row input {
                margin-right: 6px;
            }
        `;
        document.head.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.className = 'tm-column-filter-wrapper';

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'tm-column-filter-toggle';
        toggleBtn.type = 'button';
        toggleBtn.textContent = '⚙ Kolumny';

        const panel = document.createElement('div');
        panel.id = 'tm-column-filter-panel';
        panel.style.display = 'none';

        const title = document.createElement('div');
        title.className = 'tm-title';
        title.textContent = 'Zaznacz kolumny do ukrycia:';
        panel.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'tm-actions';
        const hideAllBtn = document.createElement('button');
        hideAllBtn.type = 'button';
        hideAllBtn.textContent = 'Ukryj wszystkie';
        const showAllBtn = document.createElement('button');
        showAllBtn.type = 'button';
        showAllBtn.textContent = 'Pokaż wszystkie';
        actions.appendChild(hideAllBtn);
        actions.appendChild(showAllBtn);
        panel.appendChild(actions);

        const list = document.createElement('div');

        const checkboxes = [];
        headerCells.forEach((th, idx) => {
            const inner = th.querySelector('.tablesorter-header-inner');
            const label = (inner ? inner.textContent : th.textContent).trim();

            const row = document.createElement('label');
            row.className = 'tm-column-filter-row';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = hiddenColumns.has(idx);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) hiddenColumns.add(idx); else hiddenColumns.delete(idx);
                saveHiddenColumns();
                applyColumnVisibility();
            });
            checkboxes.push(checkbox);

            row.appendChild(checkbox);
            row.appendChild(document.createTextNode(label));
            list.appendChild(row);
        });

        panel.appendChild(list);
        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(panel);

        // Wstawiamy dokładnie pod polem "Status", tuż przed przyciskiem "Filter"
        const filterBtn = document.querySelector('button.filters-table');
        if (filterBtn && filterBtn.parentNode) {
            filterBtn.parentNode.insertBefore(wrapper, filterBtn);
        } else {
            document.body.appendChild(wrapper); // zapasowo, gdyby nie udało się znaleźć przycisku Filter
        }

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        hideAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            headerCells.forEach((th, idx) => hiddenColumns.add(idx));
            checkboxes.forEach(cb => { cb.checked = true; });
            saveHiddenColumns();
            applyColumnVisibility();
        });

        showAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            hiddenColumns.clear();
            checkboxes.forEach(cb => { cb.checked = false; });
            saveHiddenColumns();
            applyColumnVisibility();
        });

        console.log('[TM hide columns script by kimrioter] Panel zbudowany, kolumn:', headerCells.length);
    }

    function setup() {
        if (initialized) return;
        const headerRow = document.getElementById('tableHead');
        if (!headerRow) return;

        initialized = true;
        hiddenColumns = loadHiddenColumns();

        const headerCells = getHeaderCells(headerRow);
        buildPanel(headerCells);
        applyColumnVisibility();

        console.log('[TM hide columns script by kimrioter] Zainicjalizowano, ukrytych kolumn:', hiddenColumns.size);
    }

    setup();

    // Reagujemy na doładowanie/odświeżenie tabeli (np. po kliknięciu "Filter"), z debounce,
    // żeby nie przeliczać widoczności zbyt często przy dynamicznych zmianach strony
    const observer = new MutationObserver(() => {
        if (!initialized) { setup(); return; }
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyColumnVisibility, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM hide columns script by kimrioter] Zainicjalizowano observer');
})();

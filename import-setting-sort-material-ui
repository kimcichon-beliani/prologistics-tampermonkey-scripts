// ==UserScript==
// @name         Czysta i posortowana lista Import Setting (Material UI)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Sortuje i czyści opcje z numerów w komponencie Material UI Select
// @author       kimrioter
// @match        https://www.prologistics.info/react/settings_page/import_tool/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/refs/heads/main/import-setting-sort-material-ui.user.js
// @downloadURL  https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts/raw/refs/heads/main/import-setting-sort-material-ui.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM sort script by kimrioter] Start');

    let isProcessing = false;

    function processMuiMenu() {
        if (isProcessing) return;

        // W Material UI otwarta lista znajduje się w kontenerze menu/popover
        const menuList = document.querySelector('.MuiMenu-paper ul, [role="listbox"]');
        if (!menuList) return;

        // Szukamy elementów opcji (MUI używa <li> z funkcją option)
        const options = Array.from(menuList.querySelectorAll('li, [role="option"]'));
        if (options.length === 0) return;

        // Sprawdzamy czy lista nie została już przez nas posortowana
        if (menuList.dataset.sorted === "true") return;

        isProcessing = true;

        // 1. Czyszczenie tekstu w opcjach listy
        options.forEach(opt => {
            // Szukamy tekstu bezpośrednio w elemencie lub jego dzieciach
            const rawText = opt.innerText.trim();

            if (/^\d+:\s*/.test(rawText)) {
                const cleanedText = rawText.replace(/^\d+:\s*/, '').trim();
                opt.innerText = cleanedText;
                opt.dataset.sortKey = cleanedText;
            } else {
                opt.dataset.sortKey = rawText;
            }
        });

        // 2. Sortowanie opcji (z pominięciem opcji domyślnej typu "Select...")
        const defaultOption = options.find(opt => opt.dataset.sortKey.toLowerCase().includes('select'));
        const dataOptions = options.filter(opt => opt !== defaultOption);

        dataOptions.sort((a, b) => {
            return a.dataset.sortKey.localeCompare(b.dataset.sortKey, undefined, { sensitivity: 'base', numeric: true });
        });

        // 3. Przearanżowanie w DOM (podmieniamy kolejność <li> wewnątrz <ul>)
        if (defaultOption) {
            menuList.appendChild(defaultOption);
        }
        dataOptions.forEach(opt => menuList.appendChild(opt));

        menuList.dataset.sorted = "true";

        console.log('[TM sort script by kimrioter] Posortowano opcji:', dataOptions.length + (defaultOption ? 1 : 0));

        setTimeout(() => {
            isProcessing = false;
        }, 100);
    }

    // Obserwator wykrywa moment, w którym Material UI tworzy menu w DOM (po kliknięciu w Select)
    const observer = new MutationObserver(() => {
        processMuiMenu();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[TM sort script by kimrioter] Zainicjalizowano observer');
})();

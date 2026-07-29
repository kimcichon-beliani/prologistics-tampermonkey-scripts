// ==UserScript==
// @name         Auftrag Search (Google Sheets Shortcut)
// @namespace    https://www.prologistics.info/
// @version      2.0
// @description  Ctrl+Shift+F in Google Sheets/Docs to search selected text directly as Auftrag on ProLogistics.
// @author       kimrioter
// @match        https://docs.google.com/spreadsheets/*
// @match        https://docs.google.com/document/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search-gsuite.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search-gsuite.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM Auftrag Search GSuite Shortcut by kimrioter] Start');

    function buildAuftragUrl(number) {
        return `https://www.prologistics.info/auction.php?number=${encodeURIComponent(number)}&txnid=3`;
    }

    function openInNewTab(url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function getSelectedText() {
        // 1. Zaznaczenie tekstowe w DOM
        let text = window.getSelection() ? window.getSelection().toString().trim() : '';

        // 2. Pobranie z aktywnego pola wprowadzania w Sheets
        if (!text) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                const start = activeEl.selectionStart;
                const end = activeEl.selectionEnd;
                if (typeof start === 'number' && typeof end === 'number' && start !== end) {
                    text = activeEl.value.substring(start, end).trim();
                } else if (activeEl.value) {
                    text = activeEl.value.trim();
                }
            }
        }

        // 3. Pasek formuł Google Sheets
        if (!text) {
            const formulaInput = document.querySelector('.cell-input textarea, #t-formula-bar-input');
            if (formulaInput && formulaInput.value) {
                text = formulaInput.value.trim();
            }
        }

        return text.replace(/[\r\n]+/g, ' ').trim();
    }

    function handleSearch() {
        const text = getSelectedText();
        if (text) {
            openInNewTab(buildAuftragUrl(text));
        } else {
            // Jeśli Google Sheets zablokowało odczyt DOM, prosimy o podanie/potwierdzenie numeru
            const manualText = prompt('Wprowadź lub potwierdź numer Auftrag do wyszukania:');
            if (manualText && manualText.trim()) {
                openInNewTab(buildAuftragUrl(manualText.trim()));
            }
        }
    }

    // Nasłuchiwanie skrótu Ctrl + Shift + F
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f' || e.code === 'KeyF')) {
            e.preventDefault();
            e.stopPropagation();
            handleSearch();
        }
    }, true);
})();

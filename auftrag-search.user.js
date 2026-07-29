// ==UserScript==
// @name         Auftrag Search (Beliani Direct Fulfilment)
// @namespace    https://www.prologistics.info/
// @version      1.4
// @description  Zaznaczenie tekstu pokazuje ikonkę Beliani, która wyszukuje zaznaczony numer jako Fulfilment bezpośrednio w Prologistics
// @author       kimrioter
// @match        *://*/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM auftrag search script by kimrioter] Start');

    const COLORS = {
        accent: '#ff2f00' // czerwony Beliani
    };

    const BELIANI_LOGO_URL = 'https://i.snipboard.io/CxDQj3.jpg';

    const BELIANI_IMG = `<img src="${BELIANI_LOGO_URL}" style="width:18px; height:18px; object-fit:contain; vertical-align:middle; border-radius:3px;" alt="B">`;

    // Krótki, szybki link "express" — wyszukuje bezpośrednio po numerze Fulfilment (what=ff_number)
    // i od razu przenosi do zamówienia, bez pokazywania listy wyników
    const FULFILMENT_URL_TEMPLATE = 'https://www.prologistics.info/search.php?express&what=ff_number&ff_number={FF_NUMBER}';

    function buildFulfilmentUrl(number) {
        return FULFILMENT_URL_TEMPLATE.replace('{FF_NUMBER}', encodeURIComponent(number));
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

    // --- PŁYWAJĄCA IKONKA BELIANI PRZY ZAZNACZENIU TEKSTU ---
    let selectionBtn = null;

    function removeSelectionButton() {
        if (selectionBtn) {
            selectionBtn.remove();
            selectionBtn = null;
        }
    }

    document.addEventListener('mouseup', () => {
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection ? selection.toString().trim() : '';

            if (selectedText.length > 0 && selectedText.length < 50) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                if (!selectionBtn) {
                    selectionBtn = document.createElement('div');
                    selectionBtn.id = 'beliani-search-btn';
                    selectionBtn.title = 'Szukaj Fulfilment w Prologistics';
                    selectionBtn.innerHTML = BELIANI_IMG;
                    selectionBtn.style.cssText = `
                        position: absolute;
                        z-index: 999998;
                        background: #ffffff;
                        border: 1.5px solid ${COLORS.accent};
                        border-radius: 50%;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    `;

                    // Delikatne powiększenie ikonki po najechaniu myszką
                    selectionBtn.addEventListener('mouseenter', () => {
                        selectionBtn.style.transform = 'scale(1.15)';
                        selectionBtn.style.boxShadow = '0 6px 16px rgba(255,47,0,0.25)';
                    });
                    selectionBtn.addEventListener('mouseleave', () => {
                        selectionBtn.style.transform = 'scale(1)';
                        selectionBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    });

                    // Od razu po kliknięciu szukamy jako Fulfilment i usuwamy ikonkę
                    selectionBtn.addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        openInNewTab(buildFulfilmentUrl(selectedText));
                        removeSelectionButton();
                    });

                    document.body.appendChild(selectionBtn);
                }

                // Pozycjonujemy ikonkę tuż nad zaznaczonym tekstem, wyśrodkowaną względem zaznaczenia
                const topPos = window.scrollY + rect.top - 36;
                const leftPos = window.scrollX + rect.left + (rect.width / 2) - 15;

                selectionBtn.style.top = `${topPos < 0 ? 5 : topPos}px`;
                selectionBtn.style.left = `${leftPos < 0 ? 5 : leftPos}px`;
            } else {
                removeSelectionButton();
            }
        }, 10);
    });

    // Usuwamy ikonkę, gdy użytkownik kliknie gdziekolwiek poza nią (np. żeby odznaczyć tekst)
    document.addEventListener('mousedown', (e) => {
        if (selectionBtn && !selectionBtn.contains(e.target)) {
            removeSelectionButton();
        }
    });

    console.log('[TM auftrag search script by kimrioter] Zainicjalizowano nasłuchiwanie zaznaczenia tekstu');
})();

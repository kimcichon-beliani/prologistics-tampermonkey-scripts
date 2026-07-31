// ==UserScript==
// @name         Auftrag Search (Beliani Direct Fulfilment)
// @namespace    https://www.prologistics.info/
// @version      1.5
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

    // Zewnętrzny URL loga - zostawiony jako pierwsza próba, ale niektóre strony
    // blokują go przez CSP (img-src), więc mamy fallback niżej.
    const BELIANI_LOGO_URL = 'https://i.snipboard.io/CxDQj3.jpg';

    // TODO (opcjonalnie, najpewniejsze rozwiązanie): podmień poniższy string
    // na base64 właściwego loga Beliani (np. "data:image/png;base64,iVBORw0KG...").
    // Wtedy obrazek działa zawsze, niezależnie od CSP strony.
    const BELIANI_LOGO_BASE64 = 'data:image/png;base64,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';

    // Fallback: inline SVG z literą "B" na czerwonym tle - zawsze się wyrenderuje,
    // bo to nie jest zewnętrzny zasób, tylko kod SVG.
    const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
            <rect width="18" height="18" rx="4" fill="${COLORS.accent}"/>
            <text x="9" y="13" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">B</text>
        </svg>`
    )}`;

    function resolveLogoSrc() {
        if (BELIANI_LOGO_BASE64) return BELIANI_LOGO_BASE64;
        return BELIANI_LOGO_URL;
    }

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

    function createLogoImg() {
        const img = document.createElement('img');
        img.src = resolveLogoSrc();
        img.alt = 'B';
        img.style.cssText = 'width:18px; height:18px; object-fit:contain; vertical-align:middle; border-radius:3px;';

        // Jeśli obrazek (np. z zewnętrznego hosta) nie załaduje się z powodu CSP
        // albo błędu sieci, podmieniamy na inline SVG, które zawsze działa.
        img.addEventListener('error', () => {
            if (img.src !== FALLBACK_SVG) {
                img.src = FALLBACK_SVG;
            }
        }, { once: true });

        return img;
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
                    selectionBtn.appendChild(createLogoImg());
                    selectionBtn.style.cssText = `
                        position: absolute;
                        z-index: 2147483647;
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
                        pointer-events: auto;
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

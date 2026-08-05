// ==UserScript==
// @name         Modern Auftrag Toolbar — Prologistics
// @namespace    https://www.prologistics.info/
// @version      1.9
// @description  Nowoczesny pasek nawigacji dopasowany do kolorystyki Prologistics (Bordo).
// @author       kimrioter
// @match        https://www.prologistics.info/auction.php*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/modern-auftrag-toolbar.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/modern-auftrag-toolbar.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM Modern Auftrag Toolbar by kimrioter] Start v1.9');

    const COLORS = {
        accent: '#750000',       // Prologistics Burgundy Red
        accentHover: '#5b0000',  // Ciemniejsze bordo na hover
        textDark: '#1e293b',
        bgPill: '#ffffff',
        border: '#cbd5e1'
    };

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            html {
                scroll-behavior: smooth;
            }

            /* Ukrywamy stary pasek ProLogistics */
            .auftrag-toolbar {
                display: none !important;
            }

            /* Nasz nowy toolbar */
            #tm-custom-auftrag-toolbar {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex-wrap: wrap !important;
                gap: 16px !important;
                margin: 16px 0 !important;
                padding: 8px 12px !important;
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 10px !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05) !important;
                max-width: fit-content !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;

                /* Centrowanie względem viewportu, nie dokumentu */
                position: sticky !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
            }

            #tm-custom-auftrag-toolbar form {
                display: inline-flex !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* Domyślny styl nawigacji */
            .tm-toolbar-btn {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 6px 14px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                color: ${COLORS.textDark} !important;
                background-color: ${COLORS.bgPill} !important;
                border: 1px solid ${COLORS.border} !important;
                border-radius: 6px !important;
                text-decoration: none !important;
                cursor: pointer !important;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }

            .tm-toolbar-btn:hover:not(.tm-btn-disabled):not(.tm-btn-primary) {
                background-color: #f8fafc !important;
                border-color: #94a3b8 !important;
                color: ${COLORS.textDark} !important;
                transform: translateY(-1px) !important;
                box-shadow: 0 3px 8px rgba(0,0,0,0.08) !important;
            }

            .tm-toolbar-btn:active:not(.tm-btn-disabled) {
                transform: translateY(0) !important;
            }

            /* Przyciski akcji głównych (New Ticket oraz aktywny Change Order) w kolorze bordo */
            .tm-btn-primary {
                background-color: ${COLORS.accent} !important;
                color: #ffffff !important;
                border-color: ${COLORS.accent} !important;
                box-shadow: 0 2px 4px rgba(117, 0, 0, 0.2) !important;
            }

            .tm-btn-primary:hover {
                background-color: ${COLORS.accentHover} !important;
                color: #ffffff !important;
                border-color: ${COLORS.accentHover} !important;
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 10px rgba(91, 0, 0, 0.35) !important;
            }

            /* Przycisk nieaktywny (np. Change Order dla wysłanego zamówienia) */
            .tm-btn-disabled {
                background-color: #f1f5f9 !important;
                color: #94a3b8 !important;
                border-color: #e2e8f0 !important;
                cursor: not-allowed !important;
                box-shadow: none !important;
                opacity: 0.7 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Szukamy oryginalnego przycisku "Change Order" - najpierw po standardowych
    // selektorach, a jeśli to nie zadziała (inna struktura na danej podstronie),
    // fallback po samej treści tekstowej. Dzięki temu wykrywanie jest odporne
    // na różnice w markupie między podstronami.
    function findChangeOrderElement(oldToolbar) {
        let el = oldToolbar.querySelector(
            'a[href*="change"], span[title*="shipped"], .auftrag-toolbar__btn--disabled'
        );
        if (el) return el;

        const candidates = oldToolbar.querySelectorAll('a, span, button');
        for (const c of candidates) {
            if (c.textContent.trim().toLowerCase().includes('change order')) {
                return c;
            }
        }
        return null;
    }

    function replaceToolbar() {
        const oldToolbar = document.querySelector('.auftrag-toolbar');
        if (!oldToolbar || document.getElementById('tm-custom-auftrag-toolbar')) return;

        const originalForm = oldToolbar.querySelector('form');
        let auftragNumber = '';
        if (originalForm) {
            const numInput = originalForm.querySelector('input[name="number"]');
            if (numInput) auftragNumber = numInput.value;
        }

        const newToolbar = document.createElement('div');
        newToolbar.id = 'tm-custom-auftrag-toolbar';

        // 1. Lewa strona nawigacji
        const links = [
            { label: 'Article', href: '#articles' },
            { label: 'Calculations', href: '#calculations' },
            { label: 'Invoice', href: '#invoice' }
        ];

        links.forEach(link => {
            const a = document.createElement('a');
            a.className = 'tm-toolbar-btn';
            a.href = link.href;
            a.textContent = link.label;
            newToolbar.appendChild(a);
        });

        // 2. Change Order
        // WAŻNE: nie tworzymy nowego elementu i nie kopiujemy tylko href —
        // jeśli oryginalny przycisk działa przez onclick / JS listener (nie tylko href),
        // kopiowanie samego atrybutu href gubi tę logikę i przycisk wygląda aktywny,
        // ale nic nie robi po kliknięciu.
        // Zamiast tego PRZENOSIMY oryginalny element do nowego toolbaru
        // (appendChild na istniejącym nodzie przenosi go, nie klonuje) —
        // wszystkie oryginalne atrybuty i handlery zostają zachowane,
        // a my tylko nadpisujemy klasy/tekst pod nowy wygląd.
        const oldChangeBtn = findChangeOrderElement(oldToolbar);
        let changeBtn;

        if (oldChangeBtn) {
            const isChangeDisabled =
                oldChangeBtn.classList.contains('auftrag-toolbar__btn--disabled') ||
                oldChangeBtn.tagName.toLowerCase() === 'span';

            changeBtn = oldChangeBtn; // przenosimy, nie kopiujemy
            changeBtn.textContent = 'Change Order';
            changeBtn.className = `tm-toolbar-btn ${isChangeDisabled ? 'tm-btn-disabled' : 'tm-btn-primary'}`;

            if (isChangeDisabled) {
                changeBtn.title = 'You cannot change the order for a shipped Auftrag';
            }
        } else {
            // Fallback, jeśli w ogóle nie znaleziono przycisku w starym toolbarze
            changeBtn = document.createElement('span');
            changeBtn.className = 'tm-toolbar-btn tm-btn-disabled';
            changeBtn.textContent = 'Change Order';
            changeBtn.title = 'Nie znaleziono oryginalnego przycisku Change Order';
        }

        newToolbar.appendChild(changeBtn);

        // 3. Formularz New Ticket
        if (auftragNumber) {
            const form = document.createElement('form');
            form.method = 'post';
            form.target = '_blank';
            form.action = 'auction.php';

            form.innerHTML = `
                <input type="hidden" name="number" value="${auftragNumber}">
                <input type="hidden" name="txnid" value="3">
                <input type="hidden" name="CRM_Ticket" value="1">
                <button type="submit" class="tm-toolbar-btn tm-btn-primary">New Ticket</button>
            `;
            newToolbar.appendChild(form);
        }

        // 4. Prawa strona nawigacji
        const rightLinks = [
            { label: 'Finance', href: '#payments' },
            { label: 'Warehouse', href: '#real_shipping_prices' }
        ];

        rightLinks.forEach(link => {
            const a = document.createElement('a');
            a.className = 'tm-toolbar-btn';
            a.href = link.href;
            a.textContent = link.label;
            newToolbar.appendChild(a);
        });

        oldToolbar.parentNode.insertBefore(newToolbar, oldToolbar);
    }

    injectStyles();
    replaceToolbar();
})();

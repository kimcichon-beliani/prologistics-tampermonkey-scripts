// ==UserScript==
// @name         Express Label Generator — Prologistics (Fixed)
// @namespace    https://www.prologistics.info/
// @version      1.2
// @description  Bypasses the manual click in "Choose warehouse" modal, auto-submits form and opens full label in a new tab. Dodatkowo: e-mail w Customer Data przestaje być linkiem (łatwiejsze kopiowanie).
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/express-label-generator.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/express-label-generator.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM Express Label Generator by kimrioter] Start');

    /* =========================================================
       CZĘŚĆ 1 — Express Label (bez zmian)
       ========================================================= */

    function hideWarehouseModal() {
        const modalContainers = document.querySelectorAll('.ui-dialog, .blockUI, .ui-widget-overlay, [class*="dialog"]');
        modalContainers.forEach(el => {
            if (el.textContent.includes('Choose warehouse') || el.classList.contains('ui-widget-overlay')) {
                el.style.display = 'none';
                const closeBtn = el.querySelector('.ui-dialog-titlebar-close, .ui-icon-closethick');
                if (closeBtn) closeBtn.click();
            }
        });
    }

    function autoSubmitWarehouseForm() {
        // Szukamy przycisku "Show label" w otwartym okienku modalnym
        const showLabelButtons = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button'));
        const targetBtn = showLabelButtons.find(btn => btn.value === 'Show label' || btn.textContent.trim() === 'Show label');

        if (targetBtn) {
            // Upewniamy się, że formularz wyśle się do nowej karty (_blank)
            const form = targetBtn.closest('form');
            if (form) {
                form.target = '_blank';
            }

            // Klikamy przycisk "Show label"
            targetBtn.click();

            // Ukrywamy okienko z ekranu
            setTimeout(hideWarehouseModal, 100);
        } else {
            // Jeśli przycisk jeszcze się nie załadował w DOM, powtarzamy próbę za moment
            setTimeout(autoSubmitWarehouseForm, 50);
        }
    }

    document.addEventListener('click', (e) => {
        const target = e.target;

        // Po kliknięciu "Label for client"
        if (target && (target.value === 'Label for client' || target.textContent.trim() === 'Label for client')) {
            // Dajemy ułamek sekundy na wygenerowanie się okienka modalnego, po czym automatycznie klikamy "Show label"
            setTimeout(() => {
                autoSubmitWarehouseForm();
            }, 100);
        }
    }, true);

    /* =========================================================
       CZĘŚĆ 2 — E-mail bez linka (Customer Data)
       Zamienia <a href="mailto:..."> na zwykły tekst.
       Jedno kliknięcie zaznacza cały adres → Ctrl+C.
       Podwójne kliknięcie kopiuje adres do schowka.
       ========================================================= */

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const MARK_CLASS = 'tm-email-plain';

    // Wstrzykujemy style raz, na starcie
    function injectEmailStyles() {
        if (document.getElementById('tm-email-plain-style')) return;
        const style = document.createElement('style');
        style.id = 'tm-email-plain-style';
        style.textContent = `
            .${MARK_CLASS} {
                cursor: text;
                user-select: all;
                -webkit-user-select: all;
                -moz-user-select: all;
                color: #000;
                text-decoration: none;
                border-bottom: 1px dotted #999;
            }
            .${MARK_CLASS}.tm-email-copied {
                background: #750000;
                color: #fff;
                border-bottom-color: transparent;
            }
        `;
        document.head.appendChild(style);
    }

    // Kopiowanie do schowka + krótkie potwierdzenie wizualne
    function copyEmail(span) {
        const text = span.textContent.trim();

        const flash = () => {
            span.classList.add('tm-email-copied');
            setTimeout(() => span.classList.remove('tm-email-copied'), 600);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(flash).catch(() => {});
        } else {
            // Fallback dla starszych przeglądarek / braku uprawnień
            const tmp = document.createElement('textarea');
            tmp.value = text;
            document.body.appendChild(tmp);
            tmp.select();
            try { document.execCommand('copy'); flash(); } catch (err) {}
            document.body.removeChild(tmp);
        }
    }

    // Zamiana <a> na <span> z zachowaniem tekstu
    function unlinkEmail(link) {
        const text = link.textContent.trim();
        const span = document.createElement('span');
        span.className = MARK_CLASS;
        span.textContent = text;
        span.title = 'Kliknij, aby zaznaczyć / kliknij dwukrotnie, aby skopiować';

        span.addEventListener('dblclick', (e) => {
            e.preventDefault();
            copyEmail(span);
        });

        link.replaceWith(span);
    }

    function unlinkAllEmails() {
        // 1) Standardowy przypadek: linki mailto:
        document.querySelectorAll('a[href^="mailto:"]').forEach(unlinkEmail);

        // 2) Zapas: link w wierszu "Email" tabelki Customer Data,
        //    gdyby nie był to mailto (np. link do wyszukiwarki)
        document.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length < 2) return;

            const label = cells[0].textContent.trim().replace(':', '').toLowerCase();
            if (label !== 'email' && label !== 'e-mail') return;

            cells[1].querySelectorAll('a').forEach(a => {
                if (EMAIL_REGEX.test(a.textContent.trim())) unlinkEmail(a);
            });
        });
    }

    injectEmailStyles();
    unlinkAllEmails();

    // Obserwator na wypadek, gdyby tabelka doładowała się później (AJAX)
    const emailObserver = new MutationObserver(() => {
        if (document.querySelector('a[href^="mailto:"]')) unlinkAllEmails();
    });
    emailObserver.observe(document.body, { childList: true, subtree: true });

    console.log('[TM Express Label Generator by kimrioter] Email unlinker aktywny');

})();

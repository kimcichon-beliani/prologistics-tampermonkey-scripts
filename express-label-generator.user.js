// ==UserScript==
// @name         Express Label Generator — Prologistics (Fixed)
// @namespace    https://www.prologistics.info/
// @version      1.1
// @description  Bypasses the manual click in "Choose warehouse" modal, auto-submits form and opens full label in a new tab.
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

})();

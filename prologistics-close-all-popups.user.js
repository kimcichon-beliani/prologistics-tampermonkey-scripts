// ==UserScript==
// @name         Prologistics - Close All popups
// @namespace    kimrioter
// @version      1.0.0
// @description  Dodaje przycisk "Close All" obok "READ and UNDERSTOOD", który zamyka wszystkie popupy naraz
// @author       kimrioter
// @match        https://www.prologistics.info/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-close-all-popups.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-close-all-popups.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const MARKER = 'tm-close-all-btn';
    const BRAND = '#750000';

    // Czy to popup typu "READ and UNDERSTOOD" (nie ruszamy innych okien typu confirm)
    function isReadPopupButton(btn) {
        return /read\s+and\s+understood/i.test(btn.textContent || '');
    }

    // Wszystkie widoczne guziki "READ and UNDERSTOOD"
    function getReadButtons() {
        return Array.from(document.querySelectorAll('.ajs-footer .ajs-ok'))
            .filter(btn => isReadPopupButton(btn) && btn.offsetParent !== null);
    }

    function closeAll() {
        const buttons = getReadButtons();
        console.log(`${LOG} Zamykam popupy: ${buttons.length}`);
        buttons.forEach(btn => btn.click());

        // Jeśli po zamknięciu wyskoczą kolejne (kolejka alertify), zamknij i je
        setTimeout(() => {
            if (getReadButtons().length > 0) closeAll();
        }, 300);
    }

    function addButton(okBtn) {
        const parent = okBtn.parentElement;
        if (!parent || parent.querySelector('.' + MARKER)) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ajs-button ' + MARKER;
        btn.textContent = 'Close All';
        btn.style.cssText = `
            background: ${BRAND};
            color: #fff;
            border: none;
            margin-left: 6px;
            cursor: pointer;
        `;
        btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            closeAll();
        });

        okBtn.insertAdjacentElement('afterend', btn);
    }

    function scan() {
        getReadButtons().forEach(addButton);
    }

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    scan();
    console.log(`${LOG} Close All popups załadowany`);
})();

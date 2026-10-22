// ==UserScript==
// @name         Prologistics - Clear address tables
// @namespace    kimcichon-beliani
// @version      1.0
// @description  Adds "Clear" buttons above the billing and delivery address tables on order.php
// @author       kimrioter
// @match        https://www.prologistics.info/order.php*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-clear-address-tables.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-clear-address-tables.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Tabele rozpoznawane po klasach CSS, nie po tekście nagłówka,
    // więc działa w każdym języku (Billing address / Faturação / ...)
    const TABLES = [
        { selector: 'table.billing',  label: '🗑 Wyczyść dane (billing)' },
        { selector: 'table.shipping', label: '🗑 Wyczyść dane (delivery)' },
    ];

    function fire(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true }));
    }

    function clearTable(table) {
        // pola tekstowe (firma, VAT, imię, nazwisko, ulica, numer, kod, miasto, e-mail, telefony)
        table.querySelectorAll('input[type="text"]').forEach(inp => {
            inp.value = '';
            fire(inp, 'input');
            fire(inp, 'change');
        });

        // tylko select "Title" (Mr./Ms.) wraca do "---";
        // kraj, state i prefiks telefonu zostają celowo nietknięte
        table.querySelectorAll('select[name*="gender_"]').forEach(sel => {
            sel.selectedIndex = 0;
            fire(sel, 'change');
        });
    }

    function addButton({ selector, label }) {
        const table = document.querySelector(selector);
        if (!table || table.dataset.clearBtnAdded) return;
        table.dataset.clearBtnAdded = '1';

        const btn = document.createElement('button');
        btn.type = 'button'; // żeby nie wysyłał formularza
        btn.textContent = label;
        btn.style.cssText =
            'display:block;margin:4px 0 8px 0;padding:4px 10px;cursor:pointer;' +
            'background:#750000;color:#fff;border:0;border-radius:3px;font-weight:bold;';
        btn.addEventListener('click', e => {
            e.preventDefault();
            clearTable(table);
        });

        // przycisk bezpośrednio nad tabelą (nad nagłówkiem Billing/Delivery address)
        table.parentNode.insertBefore(btn, table);
    }

    function init() {
        TABLES.forEach(addButton);
    }

    init();
    // gdyby strona doładowywała tabele później
    new MutationObserver(init).observe(document.body, { childList: true, subtree: true });
})();

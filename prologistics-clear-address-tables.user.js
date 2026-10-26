// ==UserScript==
// @name         Prologistics - Clear address tables
// @namespace    kimcichon-beliani
// @version      1.3
// @description  Adds small "Clear" buttons above the billing and delivery address tables on order.php (keeps e-mail)
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
        { selector: 'table.billing',  label: 'Clear' },
        { selector: 'table.shipping', label: 'Clear' },
    ];

    // style przycisku (z hoverem i efektem wciśnięcia)
    const style = document.createElement('style');
    style.textContent = `
        .tm-clear-btn {
            display: inline-block;
            margin: 2px 0 4px 0;
            padding: 2px 10px;
            font-size: 11px;
            font-family: Arial, sans-serif;
            line-height: 14px;
            color: #750000;
            background: linear-gradient(#ffffff, #e6e6e6);
            border: 1px solid #750000;
            border-radius: 4px;
            box-shadow: 0 1px 2px rgba(0,0,0,.25);
            cursor: pointer;
            user-select: none;
            transition: background .15s, color .15s, box-shadow .15s;
        }
        .tm-clear-btn:hover {
            color: #fff;
            background: linear-gradient(#a30000, #750000);
        }
        .tm-clear-btn:active {
            background: #5a0000;
            color: #fff;
            box-shadow: inset 0 1px 3px rgba(0,0,0,.5);
            transform: translateY(1px);
        }
    `;
    document.head.appendChild(style);

    function fire(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true }));
    }

    function clearTable(table) {
        // pola tekstowe (firma, VAT, imię, nazwisko, ulica, numer, kod, miasto, telefony)
        // pole e-mail (name zawiera "email_") jest pomijane
        table.querySelectorAll('input[type="text"]').forEach(inp => {
            if ((inp.name || '').includes('email_')) return;
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
        btn.className = 'tm-clear-btn';
        btn.textContent = label;
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

// ==UserScript==
// @name         Prologistics – RMA – Return Tracking pod Closing Notification
// @namespace    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @version      1.3.0
// @description  Przenosi tabelę "Return tracking numbers", formularz Tracking #/Update oraz przycisk "Label for client" pod przycisk "Closing Notification" na rma.php – bez tabeli "Tracking numbers" i bez "New driver task"
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-rma-return-tracking-move.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-rma-return-tracking-move.user.js
// ==/UserScript==

(function () {
    'use strict';

    const PREFIX = '[TM script by kimrioter]';
    const BOX_ID = 'kr-rma-moved-box';

    const HARD_STOP = [
        'Attached documents',
        'New comment',
        'Import all articles',
        'Articles:',
        'Closing Notification',
        'Comment Notification',
        'New driver task',
        'Real Return Shipping Prices',
        'Liquidators'
    ];

    // Markery tabeli "Tracking numbers" (packingowej) – ta zostaje na miejscu
    const PACKING_MARKERS = ['Packing date', 'Packed by', '# of shipments', 'Favourite pickup date'];

    const log = (...args) => console.log(PREFIX, ...args);
    const txt = el => (el && el.textContent) || '';

    /* ------------------------------------------------------------------ */
    /*  Wyszukiwanie                                                       */
    /* ------------------------------------------------------------------ */

    function findSmallestByText(text, selector = 'td, th, div, span, b, strong, legend, h1, h2, h3, h4') {
        const nodes = [...document.querySelectorAll(selector)].filter(el => txt(el).includes(text));
        if (!nodes.length) return null;
        return nodes.reduce((best, el) => (txt(el).length < txt(best).length ? el : best));
    }

    function findButtonsByLabel(label) {
        return [...document.querySelectorAll('input[type="button"], input[type="submit"], button, a')]
            .filter(el => (el.value || el.textContent || '').trim() === label);
    }

    const findButtonByLabel = label => findButtonsByLabel(label)[0] || null;

    function findReturnTable(titleEl) {
        let el = titleEl;
        while (el) {
            const table = el.closest('table');
            if (!table) return null;
            const t = txt(table);
            if (t.includes('Return tracking numbers') && !PACKING_MARKERS.some(m => t.includes(m))) {
                return table;
            }
            el = table.parentElement;
        }
        return null;
    }

    const isDirty = t =>
        PACKING_MARKERS.some(m => t.includes(m)) ||
        t.includes('Return tracking numbers') ||
        HARD_STOP.some(s => t.includes(s));

    /* ------------------------------------------------------------------ */
    /*  Formularz Tracking # / Country / Shipping method # / Label / Update */
    /* ------------------------------------------------------------------ */

    // Wariant A: istnieje czysty wspólny kontener – bierzemy go w całości
    function findFormWrapper() {
        for (const btn of findButtonsByLabel('Update')) {
            let el = btn;
            for (let i = 0; i < 8 && el && el !== document.body; i++) {
                const t = txt(el);
                if (isDirty(t)) break;
                if (t.includes('Tracking #') && t.includes('Shipping method #')) return [el];
                el = el.parentElement;
            }
        }
        return null;
    }

    // Wariant B: zakres rodzeństwa od etykiety "Tracking #" do przycisku "Update"
    function findFormRange() {
        const label = [...document.querySelectorAll('td, div, span, b, strong, label, th')]
            .filter(el => txt(el).trim() === 'Tracking #')
            .sort((a, b) => txt(a).length - txt(b).length)[0];
        if (!label) return null;

        const update = findButtonsByLabel('Update').find(btn =>
            label.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (!update) return null;

        // najmniejszy wspólny przodek
        let common = label.parentElement;
        while (common && !common.contains(update)) common = common.parentElement;
        if (!common) return null;

        const childOf = node => {
            let c = node;
            while (c && c.parentElement !== common) c = c.parentElement;
            return c;
        };

        const start = childOf(label);
        const end = childOf(update);
        if (!start || !end) return null;

        const nodes = [];
        let n = start;
        while (n) {
            nodes.push(n);
            if (n === end) break;
            n = n.nextElementSibling;
        }
        if (nodes[nodes.length - 1] !== end) return null;

        const combined = nodes.map(txt).join(' ');
        if (isDirty(combined)) {
            log('Zakres formularza zawiera obcą treść – pomijam przenoszenie formularza.');
            return null;
        }
        return nodes;
    }

    const findTrackingForm = () => findFormWrapper() || findFormRange();

    /* ------------------------------------------------------------------ */
    /*  Przenoszenie                                                       */
    /* ------------------------------------------------------------------ */

    function preserveFormOwnership(node) {
        const list = [...node.querySelectorAll('input, select, textarea, button')];
        if (node.matches && node.matches('input, select, textarea, button')) list.unshift(node);

        list.forEach(ctrl => {
            if (ctrl.hasAttribute('form')) return;
            const form = ctrl.closest('form');
            if (!form || node.contains(form)) return;
            if (!form.id) form.id = 'kr-form-' + Math.random().toString(36).slice(2, 8);
            ctrl.setAttribute('form', form.id);
        });
    }

    // Wiersze tabeli trzeba przenieść do nowej tabeli, inaczej przeglądarka je wyrzuci
    function appendNodes(box, nodes, marginTop) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top: ' + marginTop + 'px';
        box.appendChild(wrap);

        const rowLike = nodes.some(n => ['TR', 'TBODY', 'THEAD', 'TD', 'TH'].includes(n.tagName));

        if (!rowLike) {
            nodes.forEach(n => { preserveFormOwnership(n); wrap.appendChild(n); });
            return;
        }

        const src = nodes[0].closest('table');
        const table = document.createElement('table');
        if (src) {
            ['border', 'cellpadding', 'cellspacing', 'class'].forEach(a => {
                if (src.hasAttribute(a)) table.setAttribute(a, src.getAttribute(a));
            });
        }
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        wrap.appendChild(table);

        nodes.forEach(n => {
            preserveFormOwnership(n);
            if (n.tagName === 'TBODY' || n.tagName === 'THEAD') {
                table.appendChild(n);
            } else if (n.tagName === 'TD' || n.tagName === 'TH') {
                const tr = document.createElement('tr');
                tr.appendChild(n);
                tbody.appendChild(tr);
            } else {
                tbody.appendChild(n);
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Kontener docelowy                                                  */
    /* ------------------------------------------------------------------ */

    function buildBox(anchor) {
        const box = document.createElement('div');
        box.id = BOX_ID;
        box.style.cssText = 'margin: 10px 0 14px 0; padding: 0; border: 0; background: transparent; display: block; overflow: visible';

        const smallTable = anchor.closest('table');
        if (smallTable && txt(smallTable).trim().length < 400 && smallTable.parentElement) {
            smallTable.insertAdjacentElement('afterend', box);
            return box;
        }

        const row = anchor.closest('tr');
        if (row && row.parentElement) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = Math.max(row.children.length, 1);
            td.style.cssText = 'padding: 0; border: 0; overflow: visible';
            td.appendChild(box);
            tr.appendChild(td);
            row.insertAdjacentElement('afterend', tr);
            return box;
        }

        (anchor.parentElement || anchor).insertAdjacentElement('afterend', box);
        return box;
    }

    function normalize(node) {
        if (!node || node.nodeType !== 1) return;
        const fix = el => {
            const ox = getComputedStyle(el).overflowX;
            if (ox === 'auto' || ox === 'scroll') el.style.overflowX = 'visible';
        };
        fix(node);
        node.querySelectorAll('div, table').forEach(fix);
    }

    /* ------------------------------------------------------------------ */
    /*  Główna logika                                                      */
    /* ------------------------------------------------------------------ */

    function run() {
        if (document.getElementById(BOX_ID)) return true;

        const closingBtn = findButtonByLabel('Closing Notification');
        if (!closingBtn) return false;

        const titleEl = findSmallestByText('Return tracking numbers');
        if (!titleEl) return false;

        const returnTable = findReturnTable(titleEl);
        if (!returnTable) return false;

        // Formularz namierzamy PRZED przenoszeniem tabeli, żeby DOM się nie zmienił pod nogami
        const formNodes = findTrackingForm();

        const box = buildBox(closingBtn);

        // 1. Tabela zwrotów
        preserveFormOwnership(returnTable);
        box.appendChild(returnTable);
        normalize(returnTable);

        // 2. Formularz Tracking # / Update – pod tabelą
        if (formNodes && formNodes.length && !formNodes.some(n => box.contains(n))) {
            appendNodes(box, formNodes, 6);
            formNodes.forEach(normalize);
            log('Przeniesiono formularz Tracking #/Update (' + formNodes.length + ' węzeł/y).');
        } else if (!formNodes) {
            log('Nie znalazłam formularza Tracking #/Update – został na swoim miejscu.');
        }

        // 3. Przycisk "Label for client"
        const labelBtn = findButtonByLabel('Label for client');
        if (labelBtn && !box.contains(labelBtn)) {
            const form = labelBtn.closest('form');
            const labelBlock = form && txt(form).trim().length < 60 ? form : labelBtn;
            appendNodes(box, [labelBlock], 8);
        }

        log('Gotowe – blok siedzi pod "Closing Notification".');
        return true;
    }

    /* ------------------------------------------------------------------ */
    /*  Start + obserwator                                                 */
    /* ------------------------------------------------------------------ */

    if (run()) return;

    const observer = new MutationObserver(() => {
        if (run()) observer.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        observer.disconnect();
        if (!document.getElementById(BOX_ID)) {
            log('Nie znalazłam wymaganych elementów na tej stronie – skrypt nieaktywny.');
        }
    }, 20000);
})();

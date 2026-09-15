// ==UserScript==
// @name         Prologistics – Auction Pinned Panels (Customer / Articles / Payments)
// @namespace    kimrioter
// @version      1.5.1
// @description  Przypięte panele na auction.php: dane klienta (Shipping / Billing), artykuły z tabeli Articles oraz kwoty – cena, dostawa, COD, bonusy, ostrzeżenie przy cenie 0 / zamówieniu z ticketu. Wygląd jak w skrypcie "RMA Auftrag # Copy + Pinned Panels".
// @author       kimrioter
// @match        https://www.prologistics.info/auction.php*
// @match        http://www.prologistics.info/auction.php*
// @grant        GM_setClipboard
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auction-pinned-panels.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auction-pinned-panels.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG_PREFIX = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const SIG_ATTR = 'data-kr-signature';

    const STACK_ID = 'kr-panel-stack';
    const PANEL_ID = 'kr-customer-panel';
    const ART_ID = 'kr-articles-panel';
    const PAY_ID = 'kr-payments-panel';

    const LS_COLLAPSED = 'kr_auction_customer_collapsed';
    const LS_ART_COLLAPSED = 'kr_auction_articles_collapsed';
    const LS_PAY_COLLAPSED = 'kr_auction_payments_collapsed';
    const LS_MODE = 'kr_auction_customer_mode';   // 'shipping' | 'billing'

    // true -> w konsoli (F12) pojawią się rozpoznane tabele i sparsowane kwoty
    const DEBUG = false;

    let currentMode = localStorage.getItem(LS_MODE) === 'billing' ? 'billing' : 'shipping';

    /* ============================================================
       STYLE – ten sam wygląd co panele na rma.php
       ============================================================ */
    const style = document.createElement('style');
    style.textContent = `
        /* --- kontener przypiętych panelów: LEWA strona, jedzie razem ze stroną --- */
        #${STACK_ID} {
            position: fixed;
            top: 37px;                /* 25 px niżej, żeby nie zasłaniać paska nad stroną */
            left: 60px;               /* odsunięte w prawo, żeby nie zasłaniać hamburgera */
            z-index: 99999;
            width: 300px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: calc(100vh - 49px);
            overflow-y: auto;
        }

        #${STACK_ID} .kr-panel {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            background: #fff;
            border: 1px solid ${BRAND};
            border-radius: 4px;
            box-shadow: 0 3px 10px rgba(0,0,0,.25);
            overflow: hidden;
            flex: 0 0 auto;
        }
        #${PANEL_ID} { order: 1; }
        #${ART_ID}   { order: 2; }
        #${PAY_ID}   { order: 3; }

        #${STACK_ID} .kr-panel-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 8px;
            background: ${BRAND};
            color: #fff;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            user-select: none;
        }
        #${STACK_ID} .kr-panel-toggle {
            display: inline-block;
            width: 12px;
            flex: 0 0 12px;
            text-align: center;
            font-size: 10px;
            line-height: 1;
            opacity: .85;
            transform-origin: 50% 50%;
            transition: transform .15s ease;
        }
        #${STACK_ID} .kr-panel.kr-collapsed .kr-panel-toggle { transform: rotate(-90deg); }
        #${STACK_ID} .kr-panel.kr-collapsed .kr-panel-body,
        #${STACK_ID} .kr-panel.kr-collapsed .kr-panel-foot,
        #${STACK_ID} .kr-panel.kr-collapsed .kr-tabs { display: none; }

        /* wykrzyknik w nagłówku – widoczny także przy zwiniętym panelu */
        #${STACK_ID} .kr-alert-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            margin-left: 6px;
            border-radius: 50%;
            background: #ffd400;
            color: #5a3b00;
            font-size: 10px;
            font-weight: bold;
            line-height: 1;
        }
        #${STACK_ID} .kr-alert-badge.kr-alert-red {
            background: #fff;
            color: #a00000;
        }

        /* --- zakładki Shipping / Billing --- */
        #${STACK_ID} .kr-tabs {
            display: flex;
            border-bottom: 1px solid #ddd;
            background: #f2f2f2;
        }
        #${STACK_ID} .kr-tab {
            flex: 1 1 50%;
            padding: 5px 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            font-weight: bold;
            text-align: center;
            color: #666;
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            user-select: none;
            transition: color .15s ease, background .15s ease;
        }
        #${STACK_ID} .kr-tab:hover { background: #e8e8e8; color: #333; }
        #${STACK_ID} .kr-tab.kr-active {
            color: ${BRAND};
            background: #fff;
            border-bottom-color: ${BRAND};
        }
        #${STACK_ID} .kr-tab .kr-diff-dot {
            display: inline-block;
            width: 5px; height: 5px;
            margin-left: 4px;
            border-radius: 50%;
            background: #b36b00;
            vertical-align: middle;
        }

        #${STACK_ID} .kr-panel-body { padding: 6px 8px 8px; }

        #${STACK_ID} table { border-collapse: collapse; width: 100%; }

        /* JEDEN rozmiar fontu w całym stosie paneli – wiersz Total w Payments
           wyglądał na większy, bo miał własny font-size */
        #${STACK_ID} td {
            padding: 3px 2px;
            font-size: 11px;
            line-height: 1.35;
            vertical-align: top;
            border-bottom: 1px solid #eee;
            word-break: break-word;
        }
        #${STACK_ID} tr:last-child td { border-bottom: none; }
        #${STACK_ID} td.kr-label {
            width: 68px;
            font-weight: bold;
            color: #333;
            white-space: nowrap;
        }
        #${STACK_ID} td.kr-value {
            color: #000;
            user-select: text;
            cursor: text;
        }
        #${STACK_ID} td.kr-value a { color: #0645ad; text-decoration: none; }
        #${STACK_ID} td.kr-value a:hover { text-decoration: underline; }
        #${STACK_ID} td.kr-value.kr-empty { color: #aaa; }
        #${STACK_ID} td.kr-value.kr-diff { color: #b36b00; font-weight: bold; }

        /* --- wiersz z identyfikatorem (Fulfillment / ID artykułu / Ticket) --- */
        #${STACK_ID} td.kr-ident {
            text-align: center;
            font-weight: bold;
            line-height: 1.3;
            color: ${BRAND};
            padding: 3px 2px;
            background: #faf4f4;
            user-select: text;
            cursor: text;
        }
        #${STACK_ID} td.kr-ident a { color: ${BRAND}; text-decoration: none; border-bottom: 1px dotted ${BRAND}; }
        #${STACK_ID} td.kr-ident a:hover { border-bottom-style: solid; }
        #${STACK_ID} td.kr-ident .kr-copy-btn {
            height: 14px;
            min-width: 20px;
            font-size: 9px;
            margin-left: 5px;
        }

        /* --- panel Articles --- */
        #${ART_ID} td.kr-art-name {
            font-weight: bold;
            color: #333;
        }

        /* --- ostrzeżenia --- */
        #${STACK_ID} td.kr-warn {
            text-align: center;
            color: #8a6100;
            background: #fff8e1;
            padding: 5px 2px;
            font-weight: bold;
        }
        #${STACK_ID} td.kr-warn-red {
            text-align: center;
            color: #a00000;
            background: #fdeceb;
            padding: 5px 2px;
            font-weight: bold;
        }

        /* --- panel Payments --- */
        #${PAY_ID} td.kr-money {
            text-align: right;
            white-space: nowrap;
            font-weight: bold;
            color: #000;
            user-select: text;
            cursor: text;
        }
        #${PAY_ID} td.kr-money.kr-zero { color: #aaa; font-weight: normal; }
        #${PAY_ID} td.kr-money.kr-ship { color: #b36b00; }       /* są koszty dostawy */
        #${PAY_ID} td.kr-money.kr-cod  { color: #a00000; }       /* COD */
        #${PAY_ID} td.kr-money.kr-bonus { color: #2e7d32; }      /* bonus / rabat */
        #${PAY_ID} tr.kr-total td {
            border-top: 1px solid ${BRAND};
            background: #faf4f4;
            color: ${BRAND};
        }

        /* --- przycisk copy --- */
        #${STACK_ID} .kr-copy-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 6px;
            padding: 0 5px;
            height: 16px;
            min-width: 22px;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            font-weight: bold;
            line-height: 1;
            color: #fff;
            background: ${BRAND};
            border: 1px solid ${BRAND};
            border-radius: 3px;
            cursor: pointer;
            vertical-align: middle;
            transition: background .15s ease;
            user-select: none;
        }
        #${STACK_ID} .kr-copy-btn:hover { background: #a00000; border-color: #a00000; }
        #${STACK_ID} .kr-copy-btn.kr-copied { background: #2e7d32; border-color: #2e7d32; }

        /* --- stopka panelu --- */
        #${STACK_ID} .kr-panel-foot {
            display: flex;
            justify-content: center;
            gap: 6px;
            padding: 5px 0 6px;
            border-top: 1px solid #eee;
            background: #fafafa;
        }
        #${STACK_ID} .kr-foot-btn {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            font-weight: bold;
            color: #fff;
            background: ${BRAND};
            border: none;
            border-radius: 3px;
            padding: 3px 10px;
            cursor: pointer;
            user-select: none;
        }
        #${STACK_ID} .kr-foot-btn:hover { background: #a00000; }
        #${STACK_ID} .kr-foot-btn.kr-copied { background: #2e7d32; }

        #${STACK_ID} td.kr-note {
            color: #888;
            font-style: italic;
            text-align: center;
            padding: 5px 2px;
        }
    `;
    document.head.appendChild(style);

    /* ============================================================
       POMOCNICZE
       ============================================================ */

    function normalize(text) {
        return (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function labelKey(text) {
        return normalize(text).toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function truncate(text, max) {
        return text.length > max ? text.slice(0, max - 1) + '…' : text;
    }

    function hasSelectionInside(el) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
        const range = sel.getRangeAt(0);
        return el.contains(range.startContainer) || el.contains(range.endContainer);
    }

    function copyToClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            return Promise.resolve();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy') ? resolve() : reject();
            } catch (e) { reject(e); } finally { ta.remove(); }
        });
    }

    function getStack() {
        let stack = document.getElementById(STACK_ID);
        if (!stack) {
            stack = document.createElement('div');
            stack.id = STACK_ID;
            document.body.appendChild(stack);
        }
        return stack;
    }

    // alert: { text, red } -> wykrzyknik w nagłówku (żółty albo czerwony)
    function createPanelShell(id, title, lsKey, alert) {
        const panel = document.createElement('div');
        panel.id = id;
        panel.className = 'kr-panel';

        const head = document.createElement('div');
        head.className = 'kr-panel-head';

        const titleWrap = document.createElement('span');
        titleWrap.textContent = title;

        if (alert) {
            const badge = document.createElement('span');
            badge.className = 'kr-alert-badge' + (alert.red ? ' kr-alert-red' : '');
            badge.textContent = '!';
            badge.title = alert.text;
            titleWrap.appendChild(badge);
        }

        const toggle = document.createElement('span');
        toggle.className = 'kr-panel-toggle';
        toggle.textContent = '▾';

        head.appendChild(titleWrap);
        head.appendChild(toggle);

        if (localStorage.getItem(lsKey) === '1') panel.classList.add('kr-collapsed');

        head.addEventListener('click', () => {
            panel.classList.toggle('kr-collapsed');
            localStorage.setItem(lsKey, panel.classList.contains('kr-collapsed') ? '1' : '0');
        });

        panel.appendChild(head);
        return panel;
    }

    function mountPanel(panel, signature) {
        panel.setAttribute(SIG_ATTR, signature);
        const existing = document.getElementById(panel.id);
        if (existing) existing.replaceWith(panel);
        else getStack().appendChild(panel);
    }

    function buildCopyButton(getText, title) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kr-copy-btn';
        btn.textContent = 'copy';
        btn.title = title || 'Copy';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = getText();
            if (!text) return;
            copyToClipboard(text).then(() => {
                console.log(LOG_PREFIX, 'Copied:', text);
                btn.textContent = '✓';
                btn.classList.add('kr-copied');
                setTimeout(() => {
                    btn.textContent = 'copy';
                    btn.classList.remove('kr-copied');
                }, 1200);
            }).catch(err => console.error(LOG_PREFIX, 'Copy failed:', err));
        });

        return btn;
    }

    function flash(btn, originalText, text) {
        copyToClipboard(text).then(() => {
            btn.textContent = '✓ copied';
            btn.classList.add('kr-copied');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('kr-copied');
            }, 1200);
        });
    }

    // siatka tabeli z uwzględnieniem colspan/rowspan
    function buildGrid(table) {
        const grid = [];
        Array.from(table.rows || []).forEach((row, r) => {
            if (!grid[r]) grid[r] = [];
            let c = 0;
            Array.from(row.cells || []).forEach(cell => {
                while (grid[r][c] !== undefined) c++;
                const cs = cell.colSpan || 1;
                const rs = cell.rowSpan || 1;
                for (let i = 0; i < rs; i++) {
                    if (!grid[r + i]) grid[r + i] = [];
                    for (let j = 0; j < cs; j++) grid[r + i][c + j] = cell;
                }
                c += cs;
            });
        });
        return grid;
    }

    const EMPTY_VALUES = new Set(['', '-', '--', '---', 'n/a']);

    // KOLEJNOŚĆ MA ZNACZENIE: input -> tekst -> select.
    // Gdy select szedł przed tekstem, w wierszu Phone wpadał pierwszy
    // element listy prefiksów ("Austria (+43)") zamiast numeru.
    function cellValue(cell) {
        if (!cell) return '';

        const input = cell.querySelector('input[type="text"], input:not([type]), textarea');
        if (input) {
            const v = normalize(input.value);
            if (v && !EMPTY_VALUES.has(v.toLowerCase())) return v;
        }

        const clone = cell.cloneNode(true);
        clone.querySelectorAll('button, input, select, textarea, script, style').forEach(el => el.remove());
        const text = normalize(clone.textContent);
        if (text && !EMPTY_VALUES.has(text.toLowerCase())) return text;

        const select = cell.querySelector('select');
        if (select && select.selectedIndex > 0 && select.selectedOptions[0]) {
            const v = normalize(select.selectedOptions[0].textContent);
            if (v && !EMPTY_VALUES.has(v.toLowerCase())) return v;
        }

        return '';
    }

    // W komórce telefonu obok numeru siedzi jeszcze sam prefiks kraju
    // ("+33 678184276 +43"). Zostawiamy najdłuższy ciąg cyfr = właściwy numer.
    function cleanPhone(value) {
        if (!value) return '';
        const matches = value.match(/\+?\d[\d\s().\-]{3,}/g);
        if (!matches) return value;

        let best = matches[0];
        matches.forEach(m => {
            if (m.replace(/\D/g, '').length > best.replace(/\D/g, '').length) best = m;
        });
        return normalize(best);
    }

    /* ============================================================
       1) TABELA "CUSTOMER DETAILS"
       ============================================================ */

    const ROW_FIELDS = [
        { key: 'company',   label: 'Company',    match: ['company', 'companyname', 'firma'] },
        { key: 'firstname', label: 'First name', match: ['firstname', 'vorname', 'imie'] },
        { key: 'lastname',  label: 'Last name',  match: ['lastname', 'surname', 'name', 'nachname', 'nazwisko'] },
        { key: 'street',    label: 'Street',     match: ['street', 'strasse', 'ulica', 'address', 'address1'] },
        { key: 'house',     label: 'House',      match: ['house', 'housenumber', 'houseno', 'hausnummer', 'nrdomu'] },
        { key: 'zip',       label: 'ZIP',        match: ['zip', 'zipcode', 'postcode', 'postalcode', 'plz', 'kodpocztowy'] },
        { key: 'city',      label: 'City',       match: ['city', 'town', 'ort', 'miasto'] },
        { key: 'state',     label: 'State',      match: ['state', 'region', 'province'] },
        { key: 'country',   label: 'Country',    match: ['country', 'land', 'kraj'] },
        { key: 'phone',     label: 'Phone',      match: ['phone', 'telephone', 'tel', 'telefon'] },
        { key: 'mobile',    label: 'Mobile',     match: ['mobile', 'mobilephone', 'handy', 'komorka'] },
        { key: 'email',     label: 'Email',      match: ['email', 'emailaddress', 'mail'] }
    ];

    function fieldForLabel(text) {
        const k = labelKey(text);
        if (!k) return null;
        for (const f of ROW_FIELDS) if (f.match.includes(k)) return f.key;
        return null;
    }

    function findCustomerTable() {
        const anchors = ['street', 'zip', 'lastname', 'firstname'];
        for (const cell of document.querySelectorAll('td, th')) {
            if (!anchors.includes(labelKey(cell.textContent))) continue;
            const table = cell.closest('table');
            if (!table) continue;

            let hits = 0;
            Array.from(table.rows || []).forEach(r => {
                if (r.cells && r.cells[0] && fieldForLabel(r.cells[0].textContent)) hits++;
            });
            if (hits >= 3) return table;
        }
        return null;
    }

    const SAME_RE = /(identique|identical|identisch|same as|taki sam|tożsam)/i;

    function detectColumns(grid) {
        const shipScore = {};
        const billScore = {};

        grid.forEach(row => {
            (row || []).forEach((cell, c) => {
                if (!cell || c === 0) return;
                const text = normalize(cell.textContent);
                if (!text) return;

                if (/^shipping( address)?$/i.test(text)) shipScore[c] = (shipScore[c] || 0) + 3;
                if (text.length < 140 && SAME_RE.test(text) && cell.querySelector('input[type="checkbox"]')) {
                    shipScore[c] = (shipScore[c] || 0) + 2;
                }
                if (/^(billing|invoice|rechnung)/i.test(text)) billScore[c] = (billScore[c] || 0) + 3;
            });
        });

        const dataCols = new Set();
        grid.forEach(row => {
            if (!row || !row[0] || !fieldForLabel(row[0].textContent)) return;
            for (let c = 1; c < row.length; c++) {
                if (row[c] && row[c] !== row[c - 1]) dataCols.add(c);
            }
        });

        const cols = Array.from(dataCols).sort((a, b) => a - b);
        if (!cols.length) return null;

        let shipping = cols.reduce((best, c) => ((shipScore[c] || 0) > (shipScore[best] || 0) ? c : best), cols[0]);
        if (!shipScore[shipping]) shipping = cols[cols.length - 1];

        let billing = cols.reduce((best, c) => ((billScore[c] || 0) > (billScore[best] || 0) ? c : best), cols[0]);
        if (!billScore[billing] || billing === shipping) billing = cols.find(c => c !== shipping);
        if (billing === undefined) billing = shipping;

        return { shipping, billing, cols };
    }

    function collectCustomer() {
        const data = { shipping: {}, billing: {} };

        const table = findCustomerTable();
        if (!table) {
            if (DEBUG) console.log(LOG_PREFIX, 'DEBUG – Customer Details table not found');
            return data;
        }

        const grid = buildGrid(table);
        const cols = detectColumns(grid);
        if (!cols) return data;

        grid.forEach(row => {
            if (!row || !row[0]) return;
            const key = fieldForLabel(row[0].textContent);
            if (!key) return;

            let ship = cellValue(row[cols.shipping]);
            let bill = cellValue(row[cols.billing]);

            if (key === 'phone' || key === 'mobile') {
                ship = cleanPhone(ship);
                bill = cleanPhone(bill);
            }

            if (ship && !data.shipping[key]) data.shipping[key] = ship;
            if (bill && !data.billing[key]) data.billing[key] = bill;
        });

        if (DEBUG) {
            console.log(LOG_PREFIX, 'DEBUG – data columns:', cols.cols,
                        '| shipping =', cols.shipping, ', billing =', cols.billing);
            console.log(LOG_PREFIX, 'DEBUG – customer data:', JSON.parse(JSON.stringify(data)));
        }

        return data;
    }

    function findFulfillment() {
        for (const cell of document.querySelectorAll('td, th')) {
            const k = labelKey(cell.textContent);
            if (!k.startsWith('fulfillmentnumber') && !k.startsWith('fulfillmentno')) continue;
            const val = cellValue(cell.nextElementSibling);
            if (val) return val;
        }
        return null;
    }

    // "15688691 / 3 Generated from Ticket# 669774" w wierszu Auftrag #
    function findTicketInfo() {
        let best = null;
        document.querySelectorAll('td, th, div, span').forEach(el => {
            const text = normalize(el.textContent);
            if (!text || text.length > 200) return;
            const m = text.match(/generated\s+from\s+ticket\s*#?\s*(\d+)/i);
            if (!m) return;
            if (best && best.length <= text.length) return;    // wybieramy najgłębszy element
            const link = el.querySelector('a[href*="rma"], a[href*="ticket"]') || el.querySelector('a');
            best = text;
            findTicketInfo._result = { number: m[1], href: link ? link.href : null };
        });
        return best ? findTicketInfo._result : null;
    }

    /* ============================================================
       2) TABELA "ARTICLES"
       ============================================================ */

    const ART_COLUMNS = {
        id: ['id'],
        name: ['article', 'articles', 'artikel', 'product', 'produkt', 'articlename'],
        qty: ['totalquantity', 'quantity', 'qty', 'menge', 'ilosc'],
        tracking: ['trackingnumbers', 'trackingnumber', 'tracking'],
        status: ['laststatus', 'status'],
        state: ['state', 'zustand']
    };

    // Kolumny dodatkowe – po nich poznajemy, że to NAPRAWDĘ tabela Articles,
    // a nie inna tabela, która przypadkiem ma kolumny ID i Article.
    const ART_EXTRA_COLUMNS = [
        'quantitytoprocess', 'totalquantity', 'trackingnumbers', 'barcodes',
        'shippingusername', 'laststatus', 'state', 'pack', 'send', 'released',
        'route', 'reserveatwarehouse', 'shippedfromwarehouse'
    ];

    // liczba pozycji z żółtej belki "Articles (13)" – kontrola poprawności
    function findArticlesCaption() {
        let count = null;
        document.querySelectorAll('td, th, caption, div, b, strong, font, span').forEach(el => {
            if (count !== null) return;
            const m = normalize(el.textContent).match(/^articles\s*\((\d+)\)$/i);
            if (m) count = parseInt(m[1], 10);
        });
        return count;
    }

    // Wybieramy NAJLEPSZĄ tabelę, nie pierwszą z brzegu: wiersz nagłówka musi
    // mieć ID + Article ORAZ co najmniej 3 kolumny charakterystyczne dla
    // Articles. Wcześniej wygrywała pierwsza tabela z ID i Article – stąd
    // pozycja "ID 11697838" z listą numerów zamiast prawdziwych artykułów.
    function findArticlesTable() {
        const expected = findArticlesCaption();
        let best = null;

        document.querySelectorAll('table').forEach(table => {
            const grid = buildGrid(table);

            for (let r = 0; r < grid.length; r++) {
                const row = grid[r] || [];
                const map = {};
                let extras = 0;
                const seenExtras = new Set();

                row.forEach((cell, c) => {
                    if (!cell) return;
                    const k = labelKey(cell.textContent);
                    if (!k) return;
                    for (const key in ART_COLUMNS) {
                        if (map[key] === undefined && ART_COLUMNS[key].includes(k)) map[key] = c;
                    }
                    if (ART_EXTRA_COLUMNS.includes(k) && !seenExtras.has(k)) {
                        seenExtras.add(k);
                        extras++;
                    }
                });

                if (map.id === undefined || map.name === undefined) continue;
                if (extras < 3) continue;

                // ile wierszy poniżej ma sensowne ID artykułu
                let dataRows = 0;
                for (let rr = r + 1; rr < grid.length; rr++) {
                    const dr = grid[rr];
                    if (!dr) continue;
                    const idRaw = normalize((dr[map.id] || {}).textContent || '');
                    if (/\d{3,}/.test(idRaw)) dataRows++;
                }

                let score = extras * 2 + dataRows;
                if (expected !== null && dataRows === expected) score += 10;   // zgadza się z belką

                if (!best || score > best.score) best = { table, grid, headerRow: r, colMap: map, score };
                break;   // wystarczy pierwszy wiersz nagłówkowy w tej tabeli
            }
        });

        return best;
    }

    function collectArticles() {
        const result = { items: [], groups: [], total: 0, found: false };

        const found = findArticlesTable();
        if (!found) return result;
        result.found = true;

        const { grid, headerRow, colMap } = found;

        for (let r = headerRow + 1; r < grid.length; r++) {
            const row = grid[r];
            if (!row) continue;

            const idRaw = normalize((row[colMap.id] || {}).textContent || '');
            const idMatch = idRaw.match(/\d{3,}/);
            if (!idMatch) continue;                       // wiersze pomocnicze bez ID pomijamy

            const trackingRaw = colMap.tracking !== undefined
                ? normalize((row[colMap.tracking] || {}).textContent || '') : '';
            const trackingMatch = trackingRaw.match(/\b(?=[A-Z0-9]*\d)[A-Z0-9]{9,}\b/);

            const qtyRaw = colMap.qty !== undefined ? cellValue(row[colMap.qty]) : '';
            const qtyNum = parseInt((qtyRaw.match(/\d+/) || ['1'])[0], 10) || 1;

            const stateRaw = colMap.state !== undefined ? cellValue(row[colMap.state]) : '';

            result.items.push({
                id: idMatch[0],
                name: cleanArticleName(colMap.name !== undefined ? cellValue(row[colMap.name]) : ''),
                qty: qtyNum,
                tracking: trackingMatch ? trackingMatch[0] : '',
                state: cleanState(stateRaw)
            });
        }

        // Identyczne pozycje łączymy w jedną linię – 13 osobnych bloków
        // z tym samym artykułem było nieczytelne i mylące co do ilości.
        const byKey = new Map();
        result.items.forEach(item => {
            const key = item.id + '|' + item.name;
            if (!byKey.has(key)) {
                byKey.set(key, {
                    id: item.id, name: item.name, qty: 0, lines: 0,
                    trackings: new Set(), states: new Set()
                });
            }
            const g = byKey.get(key);
            g.qty += item.qty;
            g.lines++;
            if (item.tracking) g.trackings.add(item.tracking);
            if (item.state) g.states.add(item.state);
        });

        result.groups = Array.from(byKey.values()).map(g => ({
            id: g.id,
            name: g.name,
            qty: g.qty,
            lines: g.lines,
            trackings: Array.from(g.trackings),
            states: Array.from(g.states)
        }));

        result.total = result.items.length;

        if (DEBUG) console.log(LOG_PREFIX, 'DEBUG – articles:', JSON.parse(JSON.stringify(result)));

        return result;
    }

    // z nazwy wypada "Parcel stock", numery i znaczniki doklejone przez stronę
    function cleanArticleName(name) {
        return normalize((name || '')
            .replace(/parcel stock/ig, '')
            .replace(/\s+FREE\b/g, ' FREE'));
    }

    // "M-Mark as shipped by Robert Jacyna on ..." -> "Shipped"
    function cleanState(state) {
        const s = normalize(state);
        if (!s) return '';
        const m = s.match(/^(ready to ship|shipped|picked|packed|cancelled|returned|reserved)/i);
        if (m) return m[1];
        return truncate(s.split(' by ')[0].split(' on ')[0], 28);
    }

    /* ============================================================
       3) KWOTY ZAMÓWIENIA
       ------------------------------------------------------------
       Źródło główne: linia kontrolna pod pozycjami, np.
         * price = invoice->total_price (139.99) + invoice->total_cc_fee (0.00)
           + invoice->total_shipping (35) + invoice->total_cod (0) = 174.99
       Identyczna we wszystkich językach, więc nie trzeba zgadywać etykiet
       typu "Frais de livraison" / "Versandkosten" / "Koszty dostawy".
       ============================================================ */

    const SHIPPING_LABEL_RE = new RegExp([
        'frais de livraison', 'frais de port', 'livraison',
        'shipping', 'delivery cost', 'delivery charge',
        'versandkosten', 'versand', 'lieferkosten',
        'koszty dostawy', 'koszt dostawy', 'dostawa', 'przesyłk',
        'spese di spedizione', 'spedizione',
        'gastos de envío', 'gastos de envio', 'envío', 'envio',
        'verzendkosten', 'fraktkostnad', 'frakt', 'leveringsomkostninger',
        'porto', 'portokosten'
    ].join('|'), 'i');

    const BONUS_LABEL_RE = new RegExp([
        'bonus', 'rabatt', 'rabat', 'remise', 'réduction', 'reduction',
        'discount', 'descuento', 'sconto', 'korting', 'zniżk', 'znizk',
        'gutschein', 'coupon', 'kupon', 'voucher', 'gift card', 'carte cadeau',
        'promo', 'credit note', 'avoir'
    ].join('|'), 'i');

    const TOTAL_LABEL_RE = /^(total|totale|totaal|totalt|gesamt|gesamtbetrag|suma|razem|importe total)\b/i;

    function parseMoney(raw) {
        if (raw === null || raw === undefined) return null;
        let t = String(raw).replace(/[^\d.,\-]/g, '').trim();
        if (!t) return null;

        if (t.includes(',') && t.includes('.')) {
            // 1.234,56 albo 1,234.56 – rozstrzyga to, co stoi bliżej końca
            t = t.lastIndexOf(',') > t.lastIndexOf('.')
                ? t.replace(/\./g, '').replace(',', '.')
                : t.replace(/,/g, '');
        } else if (t.includes(',')) {
            t = t.replace(',', '.');
        }

        const v = parseFloat(t);
        return isNaN(v) ? null : v;
    }

    const CURRENCY_RE = /(€|EUR|CHF|PLN|zł|SEK|NOK|DKK|GBP|£|\$)/;

    function moneyInCell(cell) {
        if (!cell) return null;
        const text = normalize(cell.textContent);
        if (!text || text.includes('%')) return null;
        if (!/\d/.test(text)) return null;
        if (!CURRENCY_RE.test(text) && !/^-?[\d\s.,]+$/.test(text)) return null;
        return parseMoney(text);
    }

    function collectPayments() {
        const out = {
            price: null, shipping: null, ccFee: null, cod: null,
            total: null, currency: '', bonuses: [], source: null
        };

        // --- linia kontrolna (niezależna od języka) ---
        let formula = null;
        document.querySelectorAll('font, small, i, em, span, div, td, p').forEach(el => {
            const t = el.textContent;
            if (!t || t.indexOf('total_price') === -1 || t.length > 500) return;
            if (!formula || t.length < formula.length) formula = t;
        });

        if (formula) {
            const grab = (re) => {
                const m = formula.match(re);
                return m ? parseMoney(m[1]) : null;
            };
            out.price = grab(/total_price\s*\(([^)]*)\)/);
            out.ccFee = grab(/total_cc_fee\s*\(([^)]*)\)/);       // <- tu siedzi COD
            out.shipping = grab(/total_shipping\s*\(([^)]*)\)/);
            out.cod = grab(/total_cod\s*\(([^)]*)\)/);

            const m = formula.match(/=\s*(-?[\d.,]+)\s*$/);
            if (m) out.total = parseMoney(m[1]);
            out.source = 'formula';
        }

        // --- tabela podsumowania: waluta, bonusy, wartości zapasowe ---
        const seen = new Set();

        document.querySelectorAll('tr').forEach(row => {
            const cells = Array.from(row.cells || []);
            if (cells.length < 2) return;

            const label = normalize(cells[0].textContent);
            if (!label || label.length > 70) return;

            let amount = null;
            for (let i = cells.length - 1; i >= 1; i--) {
                amount = moneyInCell(cells[i]);
                if (amount !== null) break;
            }
            if (amount === null) return;

            if (!out.currency) {
                const cm = normalize(row.textContent).match(CURRENCY_RE);
                if (cm) out.currency = cm[1];
            }

            if (BONUS_LABEL_RE.test(label) || amount < 0) {
                const sig = label + '|' + amount;
                if (!seen.has(sig)) {
                    seen.add(sig);
                    out.bonuses.push({ label, value: amount });
                }
                return;
            }

            if (out.shipping === null && SHIPPING_LABEL_RE.test(label)) {
                out.shipping = amount;
                out.source = out.source || 'table';
            }
            if (out.total === null && TOTAL_LABEL_RE.test(label) && !/ht|tva|vat|netto|net\b/i.test(label)) {
                out.total = amount;
                out.source = out.source || 'table';
            }
        });

        if (!out.currency) out.currency = '€';

        if (DEBUG) console.log(LOG_PREFIX, 'DEBUG – payments:', JSON.parse(JSON.stringify(out)));

        return out;
    }

    /* ============================================================
       PANEL: CUSTOMER DATA
       ============================================================ */

    function hasDifference(data) {
        const keys = ['company', 'firstname', 'lastname', 'street', 'house', 'zip', 'city', 'country'];
        const shipHas = keys.some(k => data.shipping[k]);
        const billHas = keys.some(k => data.billing[k]);
        if (!shipHas || !billHas) return false;
        return keys.some(k => (data.shipping[k] || '') !== (data.billing[k] || ''));
    }

    function buildTabs(data) {
        const tabs = document.createElement('div');
        tabs.className = 'kr-tabs';

        [['shipping', 'Shipping'], ['billing', 'Billing']].forEach(([mode, label]) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'kr-tab' + (currentMode === mode ? ' kr-active' : '');
            tab.textContent = label;

            if (mode === 'billing' && hasDifference(data)) {
                const dot = document.createElement('span');
                dot.className = 'kr-diff-dot';
                dot.title = 'Billing address differs from shipping address';
                tab.appendChild(dot);
            }

            tab.addEventListener('click', (e) => {
                e.stopPropagation();                 // klik w zakładkę nie zwija panelu
                if (currentMode === mode) return;
                currentMode = mode;
                localStorage.setItem(LS_MODE, mode);
                buildCustomerPanel(true);
            });

            tabs.appendChild(tab);
        });

        return tabs;
    }

    function formatAddress(d) {
        const lines = [];
        if (d.company) lines.push(d.company);
        const person = [d.firstname, d.lastname].filter(Boolean).join(' ');
        if (person) lines.push(person);
        const street = [d.street, d.house].filter(Boolean).join(' ');
        if (street) lines.push(street);
        const city = [d.zip, d.city].filter(Boolean).join(' ');
        if (city) lines.push(city);
        if (d.state) lines.push(d.state);
        if (d.country) lines.push(d.country);
        if (d.phone) lines.push('Phone: ' + d.phone);
        if (d.mobile && d.mobile !== d.phone) lines.push('Mobile: ' + d.mobile);
        if (d.email) lines.push(d.email);
        return lines.join('\n');
    }

    function buildCustomerPanel(force) {
        const data = collectCustomer();
        const active = data[currentMode];
        const other = data[currentMode === 'shipping' ? 'billing' : 'shipping'];

        if (!Object.keys(data.shipping).length && !Object.keys(data.billing).length) return;

        const fulfillment = findFulfillment();

        const signature = currentMode + '::' + (fulfillment || '') + '::' +
            ROW_FIELDS.map(f => f.key + '=' + (active[f.key] || '')).join('|');

        const existing = document.getElementById(PANEL_ID);
        if (!force && existing) {
            if (existing.getAttribute(SIG_ATTR) === signature) return;
            if (hasSelectionInside(existing)) return;   // nie kasujemy zaznaczenia użytkownika
        }

        const panel = createPanelShell(PANEL_ID, `Customer Data (${currentMode})`, LS_COLLAPSED);
        panel.appendChild(buildTabs(data));

        const body = document.createElement('div');
        body.className = 'kr-panel-body';
        const table = document.createElement('table');

        if (fulfillment) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.className = 'kr-ident';
            td.colSpan = 2;
            td.appendChild(document.createTextNode('Fulfillment ' + fulfillment));
            td.appendChild(buildCopyButton(() => fulfillment, 'Copy fulfillment number'));
            tr.appendChild(td);
            table.appendChild(tr);
        }

        let visibleFields = 0;

        ROW_FIELDS.forEach(f => {
            const val = active[f.key];
            const otherVal = other[f.key];
            if (!val && !otherVal) return;
            visibleFields++;

            const tr = document.createElement('tr');

            const tdLabel = document.createElement('td');
            tdLabel.className = 'kr-label';
            tdLabel.textContent = f.label;

            const tdValue = document.createElement('td');
            tdValue.className = 'kr-value';

            if (val) {
                if (f.key === 'email') {
                    const a = document.createElement('a');
                    a.href = 'mailto:' + val;
                    a.textContent = val;
                    tdValue.appendChild(a);
                } else {
                    tdValue.textContent = val;
                }
                if (otherVal && otherVal !== val) {
                    tdValue.classList.add('kr-diff');
                    tdValue.title = 'Differs from the other address';
                }
            } else {
                tdValue.classList.add('kr-empty');
                tdValue.textContent = '–';
            }

            tr.appendChild(tdLabel);
            tr.appendChild(tdValue);
            table.appendChild(tr);
        });

        if (!visibleFields) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.className = 'kr-note';
            td.textContent = 'No data for this mode';
            tr.appendChild(td);
            table.appendChild(tr);
        }

        body.appendChild(table);
        panel.appendChild(body);

        if (visibleFields) {
            const foot = document.createElement('div');
            foot.className = 'kr-panel-foot';

            const addrBtn = document.createElement('button');
            addrBtn.type = 'button';
            addrBtn.className = 'kr-foot-btn';
            addrBtn.textContent = 'Copy address';
            addrBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                flash(addrBtn, 'Copy address', formatAddress(active));
            });

            const mailBtn = document.createElement('button');
            mailBtn.type = 'button';
            mailBtn.className = 'kr-foot-btn';
            mailBtn.textContent = 'Copy e-mail';
            mailBtn.style.opacity = active.email ? '1' : '.5';
            mailBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (active.email) flash(mailBtn, 'Copy e-mail', active.email);
            });

            foot.appendChild(addrBtn);
            foot.appendChild(mailBtn);
            panel.appendChild(foot);
        }

        mountPanel(panel, signature);
        console.log(LOG_PREFIX, 'Customer Data panel refreshed –', currentMode);
    }

    /* ============================================================
       PANEL: ARTICLES
       ============================================================ */

    function buildArticlesPanel(force) {
        const data = collectArticles();
        if (!data.found) {
            if (DEBUG) console.log(LOG_PREFIX, 'DEBUG – Articles table not found');
            return;
        }

        const groups = data.groups;
        const signature = data.total + '::' + groups
            .map(g => [g.id, g.name, g.qty, g.trackings.join(','), g.states.join(',')].join('~'))
            .join('|');

        const existing = document.getElementById(ART_ID);
        if (!force && existing) {
            if (existing.getAttribute(SIG_ATTR) === signature) return;
            if (hasSelectionInside(existing)) return;
        }

        const panel = createPanelShell(
            ART_ID, `Articles (${data.total})`, LS_ART_COLLAPSED,
            data.total ? null : { text: 'No article assigned to this order', red: true }
        );

        const body = document.createElement('div');
        body.className = 'kr-panel-body';
        const table = document.createElement('table');

        if (!groups.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.className = 'kr-warn-red';
            td.textContent = '! No article in this order';
            tr.appendChild(td);
            table.appendChild(tr);
        }

        const MAX_GROUPS = 6;

        groups.slice(0, MAX_GROUPS).forEach(g => {
            // pasek pozycji: ID + ilość sztuk
            const identTr = document.createElement('tr');
            const identTd = document.createElement('td');
            identTd.className = 'kr-ident';
            identTd.colSpan = 2;
            identTd.appendChild(document.createTextNode(
                'ID ' + g.id + (g.qty > 1 ? '  ×' + g.qty : '')
            ));
            identTd.appendChild(buildCopyButton(() => g.id, 'Copy article ID'));
            identTr.appendChild(identTd);
            table.appendChild(identTr);

            if (g.name) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.className = 'kr-art-name';
                td.colSpan = 2;
                td.textContent = truncate(g.name, 70);
                td.title = g.name;
                tr.appendChild(td);
                table.appendChild(tr);
            }

            const addRow = (label, node, title) => {
                const tr = document.createElement('tr');

                const tdLabel = document.createElement('td');
                tdLabel.className = 'kr-label';
                tdLabel.textContent = label;

                const tdValue = document.createElement('td');
                tdValue.className = 'kr-value';
                tdValue.appendChild(node);
                if (title) tdValue.title = title;

                tr.appendChild(tdLabel);
                tr.appendChild(tdValue);
                table.appendChild(tr);
            };

            // tracking: jeden numer z przyciskiem copy, kilka -> "numer +N"
            if (g.trackings.length) {
                const wrap = document.createElement('span');
                const first = g.trackings[0];
                wrap.appendChild(document.createTextNode(first));
                if (g.trackings.length > 1) {
                    const more = document.createElement('span');
                    more.style.color = '#888';
                    more.textContent = ' +' + (g.trackings.length - 1);
                    wrap.appendChild(more);
                }
                wrap.appendChild(buildCopyButton(
                    () => g.trackings.join('\n'),
                    g.trackings.length > 1 ? 'Copy all tracking numbers' : 'Copy tracking number'
                ));
                addRow('Tracking', wrap, g.trackings.join(', '));
            }

            // status: jeden dla wszystkich sztuk albo "mixed"
            if (g.states.length) {
                const span = document.createElement('span');
                span.textContent = g.states.length === 1 ? g.states[0] : 'mixed (' + g.states.length + ')';
                addRow('State', span, g.states.join(' / '));
            }
        });

        if (groups.length > MAX_GROUPS) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.className = 'kr-note';
            td.textContent = '+ ' + (groups.length - MAX_GROUPS) + ' more position(s) in the table';
            tr.appendChild(td);
            table.appendChild(tr);
        }

        body.appendChild(table);
        panel.appendChild(body);

        mountPanel(panel, signature);
        console.log(LOG_PREFIX, 'Articles panel refreshed –', data.total, 'row(s),', groups.length, 'position(s)');
    }

    /* ============================================================
       PANEL: PAYMENTS
       ============================================================ */

    function fmtMoney(value, currency) {
        if (value === null || value === undefined) return '–';
        return value.toFixed(2).replace('.', ',') + ' ' + currency;
    }

    function moneyRow(table, label, value, currency, cssClass, isTotal) {
        const tr = document.createElement('tr');
        if (isTotal) tr.className = 'kr-total';

        const tdLabel = document.createElement('td');
        tdLabel.className = 'kr-label';
        tdLabel.textContent = label;

        const tdValue = document.createElement('td');
        tdValue.className = 'kr-money' + (cssClass ? ' ' + cssClass : '');
        if (value === 0) tdValue.classList.add('kr-zero');
        tdValue.textContent = fmtMoney(value, currency);

        tr.appendChild(tdLabel);
        tr.appendChild(tdValue);
        table.appendChild(tr);
    }

    function buildPaymentsPanel(force) {
        const p = collectPayments();

        const hasAnything = [p.price, p.shipping, p.ccFee, p.cod, p.total].some(v => v !== null) || p.bonuses.length;
        if (!hasAnything) return;

        const ticket = findTicketInfo();
        // zerowa cena = zwykle zamówienie wygenerowane z ticketu (reklamacja / wymiana)
        const zeroPrice = (p.price === 0) || (p.price === null && p.total === 0);

        const signature = [p.price, p.ccFee, p.shipping, p.cod, p.total, p.currency].join('|') +
            '::' + p.bonuses.map(b => b.label + '=' + b.value).join('|') +
            '::' + (ticket ? ticket.number : '');

        const existing = document.getElementById(PAY_ID);
        if (!force && existing) {
            if (existing.getAttribute(SIG_ATTR) === signature) return;
            if (hasSelectionInside(existing)) return;
        }

        const panel = createPanelShell(
            PAY_ID, 'Payments', LS_PAY_COLLAPSED,
            zeroPrice ? { text: ticket ? 'Zero price – order generated from a ticket' : 'Zero price', red: true } : null
        );

        const body = document.createElement('div');
        body.className = 'kr-panel-body';
        const table = document.createElement('table');

        // ticket pokazujemy zawsze, gdy zamówienie z niego powstało
        if (ticket) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.className = 'kr-ident';
            td.colSpan = 2;
            td.appendChild(document.createTextNode('From Ticket# '));

            if (ticket.href) {
                const a = document.createElement('a');
                a.href = ticket.href;
                a.textContent = ticket.number;
                td.appendChild(a);
            } else {
                td.appendChild(document.createTextNode(ticket.number));
            }
            td.appendChild(buildCopyButton(() => ticket.number, 'Copy ticket number'));

            tr.appendChild(td);
            table.appendChild(tr);
        }

        if (zeroPrice) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.className = 'kr-warn-red';
            td.textContent = ticket ? '! Zero price – ticket order' : '! Zero price';
            tr.appendChild(td);
            table.appendChild(tr);
        }

        if (p.price !== null) moneyRow(table, 'Price', p.price, p.currency);

        if (p.shipping !== null) {
            moneyRow(table, 'Shipping', p.shipping, p.currency, p.shipping > 0 ? 'kr-ship' : '');
        }

        // COD siedzi w nawiasie przy total_cc_fee
        if (p.ccFee !== null && p.ccFee !== 0) moneyRow(table, 'COD', p.ccFee, p.currency, 'kr-cod');
        if (p.cod !== null && p.cod !== 0) moneyRow(table, 'COD (extra)', p.cod, p.currency, 'kr-cod');

        p.bonuses.forEach(b => moneyRow(table, truncate(b.label, 22), b.value, p.currency, 'kr-bonus'));

        if (p.total !== null) moneyRow(table, 'Total', p.total, p.currency, '', true);

        const flags = [];
        if (p.shipping) flags.push('shipping');
        if (p.ccFee || p.cod) flags.push('COD');
        if (p.bonuses.length) flags.push('bonus');

        const noteTr = document.createElement('tr');
        const noteTd = document.createElement('td');
        noteTd.colSpan = 2;
        noteTd.className = 'kr-note';
        noteTd.textContent = flags.length ? 'Includes: ' + flags.join(', ') : 'Item price only';
        noteTr.appendChild(noteTd);
        table.appendChild(noteTr);

        body.appendChild(table);
        panel.appendChild(body);

        const foot = document.createElement('div');
        foot.className = 'kr-panel-foot';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kr-foot-btn';
        btn.textContent = 'Copy breakdown';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const lines = [];
            if (ticket) lines.push('From Ticket# ' + ticket.number);
            if (p.price !== null) lines.push('Price: ' + fmtMoney(p.price, p.currency));
            if (p.shipping !== null) lines.push('Shipping: ' + fmtMoney(p.shipping, p.currency));
            if (p.ccFee) lines.push('COD: ' + fmtMoney(p.ccFee, p.currency));
            if (p.cod) lines.push('COD (extra): ' + fmtMoney(p.cod, p.currency));
            p.bonuses.forEach(b => lines.push(b.label + ': ' + fmtMoney(b.value, p.currency)));
            if (p.total !== null) lines.push('Total: ' + fmtMoney(p.total, p.currency));
            flash(btn, 'Copy breakdown', lines.join('\n'));
        });
        foot.appendChild(btn);
        panel.appendChild(foot);

        mountPanel(panel, signature);
        console.log(LOG_PREFIX, 'Payments panel refreshed – source:', p.source);
    }

    /* ============================================================
       START + OBSERWATOR DOM
       ============================================================ */

    function run() {
        buildCustomerPanel(false);
        buildArticlesPanel(false);
        buildPaymentsPanel(false);
    }

    run();

    let timer = null;
    const observer = new MutationObserver(mutations => {
        // ignorujemy zmiany wywołane przez same panele
        const relevant = mutations.some(m => {
            const t = m.target;
            return !(t.closest && t.closest('#' + STACK_ID));
        });
        if (!relevant) return;

        clearTimeout(timer);
        timer = setTimeout(run, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();

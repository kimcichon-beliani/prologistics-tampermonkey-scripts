// ==UserScript==
// @name         Prologistics – RMA Auftrag # Copy + Pinned Panels
// @namespace    kimrioter
// @version      2.3.1
// @description  1) Przycisk "copy" obok numeru Auftrag. 2) Przypięty panel z nr ticketu, nr Auftrag i danymi klienta (przełącznik Shipping / Billing). 3) Przypięty panel z Real Return Shipping Prices. 4) Unowocześniony wygląd przycisków na całej stronie.
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @grant        GM_setClipboard
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-auftrag-copy.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-auftrag-copy.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG_PREFIX = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const MARK = 'data-kr-copy-btn';            // znacznik dla przycisku copy
    const SIG_ATTR = 'data-kr-signature';       // sygnatura treści panelu

    const STACK_ID = 'kr-panel-stack';          // wspólny kontener panelów
    const PANEL_ID = 'kr-customer-panel';
    const PRICES_ID = 'kr-prices-panel';

    const LS_COLLAPSED = 'kr_customer_panel_collapsed';
    const LS_PRICES_COLLAPSED = 'kr_prices_panel_collapsed';
    const LS_MODE = 'kr_customer_panel_mode';   // 'shipping' | 'billing'

    // aktualnie wybrany tryb danych klienta
    let currentMode = localStorage.getItem(LS_MODE) === 'billing' ? 'billing' : 'shipping';

    /* ============================================================
       STYLE
       ============================================================ */
    const style = document.createElement('style');
    style.textContent = `
        /* --- unowocześnione przyciski na całej stronie ---
           Style trafiają WYŁĄCZNIE na przyciski oznaczone klasą przez modernizeButtons().
           Dzięki temu kolorowe przyciski szablonów zachowują swoje tło i pozostają czytelne. */
        .kr-btn {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            font-weight: bold;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            transition: filter .12s ease, border-color .12s ease, color .12s ease, box-shadow .12s ease;
        }
        .kr-btn:active { transform: translateY(1px); }

        /* przyciski bez własnego koloru – nowy, jednolity wygląd */
        .kr-btn-plain {
            color: #333;
            background: linear-gradient(#fff, #f0f0f0);
            border: 1px solid #c4c4c4;
            box-shadow: 0 1px 2px rgba(0,0,0,.08);
        }
        .kr-btn-plain:hover {
            color: ${BRAND};
            border-color: ${BRAND};
            background: linear-gradient(#fff, #f7ecec);
            box-shadow: 0 2px 4px rgba(117,0,0,.15);
        }
        .kr-btn-plain:active {
            background: #f0e2e2;
            box-shadow: inset 0 1px 2px rgba(0,0,0,.12);
        }
        .kr-btn-plain:disabled {
            color: #aaa;
            background: #f5f5f5;
            border-color: #ddd;
            box-shadow: none;
            cursor: default;
        }

        /* przyciski z własnym kolorem (szablony maili) – zostawiamy ich kolory nietknięte */
        .kr-btn-colored {
            border: 1px solid rgba(0,0,0,.18);
            box-shadow: 0 1px 2px rgba(0,0,0,.12);
        }
        .kr-btn-colored:hover {
            filter: brightness(1.06);
            box-shadow: 0 2px 5px rgba(0,0,0,.18);
        }

        /* pola tekstowe i selecty – żeby nie odstawały od nowych przycisków */
        input[type="text"],
        input[type="search"],
        input[type="password"],
        select,
        textarea {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            border: 1px solid #c4c4c4;
            border-radius: 4px;
            padding: 3px 5px;
            transition: border-color .12s ease, box-shadow .12s ease;
        }
        input[type="text"]:focus,
        input[type="search"]:focus,
        input[type="password"]:focus,
        select:focus,
        textarea:focus {
            outline: none;
            border-color: ${BRAND};
            box-shadow: 0 0 0 2px rgba(117,0,0,.12);
        }

        /* --- przycisk copy przy Auftrag # --- */
        .kr-copy-btn {
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
        .kr-copy-btn:hover { background: #a00000; border-color: #a00000; }
        .kr-copy-btn.kr-copied { background: #2e7d32; border-color: #2e7d32; }

        /* --- kontener przypiętych panelów --- */
        #${STACK_ID} {
            position: fixed;
            top: 12px;
            right: 100px;   /* odsunięte w lewo, żeby nie nachodziło na przycisk dark mode */
            z-index: 99999;
            width: 300px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: calc(100vh - 24px);
            overflow-y: auto;
        }

        /* --- wspólny wygląd panelu --- */
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
        #${PRICES_ID} { order: 2; }

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
            /* jeden glif obracany o 90° – dzięki temu nic się nie przesuwa przy zwijaniu */
            transform-origin: 50% 50%;
            transition: transform .15s ease;
        }
        #${STACK_ID} .kr-panel.kr-collapsed .kr-panel-toggle { transform: rotate(-90deg); }
        #${STACK_ID} .kr-panel.kr-collapsed .kr-panel-body,
        #${STACK_ID} .kr-panel.kr-collapsed .kr-tabs { display: none; }

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

        #${STACK_ID} .kr-panel-body { padding: 6px 8px 8px; }

        #${STACK_ID} table { border-collapse: collapse; width: 100%; }
        #${STACK_ID} td {
            padding: 3px 2px;
            vertical-align: top;
            border-bottom: 1px solid #eee;
            word-break: break-word;
        }
        #${STACK_ID} tr:last-child td { border-bottom: none; }
        #${STACK_ID} td.kr-label {
            width: 72px;
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

        /* --- wiersz z identyfikatorem (Ticket / Auftrag) --- */
        #${STACK_ID} td.kr-ident .kr-ident-link {
            color: ${BRAND};
            text-decoration: none;
            border-bottom: 1px dotted ${BRAND};
        }
        #${STACK_ID} td.kr-ident .kr-ident-link:hover { border-bottom-style: solid; }
        #${STACK_ID} td.kr-ident .kr-copy-btn {
            height: 14px;
            min-width: 20px;
            font-size: 9px;
            margin-left: 5px;
        }
        #${STACK_ID} td.kr-ident {
            text-align: center;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px !important;   /* dokładnie jak Company / Name / Address */
            font-weight: bold;
            line-height: 1.3;
            letter-spacing: 0;
            color: ${BRAND};
            padding: 3px 2px;
            background: #faf4f4;
            user-select: text;            /* łatwe zaznaczanie i kopiowanie numeru */
            cursor: text;
        }

        /* --- panel Real Return Prices --- */
        #${PRICES_ID} td.kr-group {
            font-weight: bold;
            color: #333;
            background: #e6efe6;      /* jak zielona belka produktu na stronie */
            border-top: 1px solid #bbb;
            padding: 4px 4px;
            line-height: 1.3;
            user-select: text;
        }
        #${PRICES_ID} tr:first-child td.kr-group { border-top: none; }
        #${PRICES_ID} table {
            table-layout: fixed;      /* stałe szerokości kolumn – bez tego długie nazwy
                                         i ceny w dwóch walutach rozjeżdżały tabelę */
            width: 100%;
        }
        #${PRICES_ID} td.kr-price-id {
            white-space: nowrap;
            overflow: hidden;
            color: #0645ad;
            user-select: text;
        }
        #${PRICES_ID} td.kr-price-id a { color: #0645ad; text-decoration: none; }
        #${PRICES_ID} td.kr-price-id a:hover { text-decoration: underline; }
        #${PRICES_ID} td.kr-price-name {
            color: #000;
            word-break: normal;          /* łamiemy po spacjach, nie po literach */
            overflow-wrap: break-word;
            hyphens: none;
            user-select: text;
            cursor: text;
        }
        #${PRICES_ID} td.kr-price-name .kr-country {
            color: #666;
            margin-right: 4px;
        }
        #${PRICES_ID} td.kr-price-value {
            text-align: right;
            white-space: nowrap;         /* każda linia ceny w całości, bez zawijania */
            line-height: 1.3;
            font-weight: bold;
            color: #e08a00;              /* jak pomarańczowe ceny w oryginalnej tabeli */
            user-select: text;
            cursor: text;
        }
        #${PRICES_ID} td.kr-price-value .kr-price-alt {
            display: block;
            font-weight: normal;
            font-size: 9px;
            line-height: 1.25;
            white-space: nowrap;
            opacity: .8;
        }
        #${PRICES_ID} tr.kr-cheapest td { background: #eef7ee; }
        #${PRICES_ID} tr.kr-cheapest td.kr-price-value { color: #2e7d32; }
        /* --- poziomy przewijany zestaw bloków --- */
        #${PRICES_ID} .kr-prices-body { padding: 0; }
        #${PRICES_ID} .kr-scroller {
            display: flex;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-snap-type: x mandatory;
            scrollbar-width: thin;
        }
        #${PRICES_ID} .kr-scroller::-webkit-scrollbar { height: 6px; }
        #${PRICES_ID} .kr-scroller::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 3px;
        }
        #${PRICES_ID} .kr-slide {
            flex: 0 0 100%;
            min-width: 100%;
            scroll-snap-align: start;
            padding: 6px 8px 8px;
            box-sizing: border-box;
            overflow-x: auto;            /* gdy tabela nie mieści się w 300 px */
        }
        #${PRICES_ID} .kr-slide-title {
            font-weight: bold;
            color: #333;
            background: #f0f0f0;
            padding: 4px;
            margin-bottom: 4px;
            line-height: 1.3;
            border-radius: 2px;
            user-select: text;
        }
        #${PRICES_ID} .kr-slide-title-green {
            background: #c3e6c3;      /* jak zielona belka produktu = korzystniejszy wariant */
            color: #14571b;
        }
        #${PRICES_ID} .kr-slide-title-summary {
            background: #fdeceb;      /* tabela zbiorcza – jak czerwony nagłówek na stronie */
            color: ${BRAND};
        }
        #${PRICES_ID} .kr-nav {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 4px 0 6px;
            border-top: 1px solid #eee;
            background: #fafafa;
        }
        #${PRICES_ID} .kr-nav-btn {
            width: 20px;
            height: 18px;
            font-size: 13px;
            line-height: 1;
            font-weight: bold;
            color: #fff;
            background: ${BRAND};
            border: none;
            border-radius: 3px;
            cursor: pointer;
            user-select: none;
        }
        #${PRICES_ID} .kr-nav-btn:hover { background: #a00000; }
        #${PRICES_ID} .kr-nav-counter {
            font-size: 10px;
            font-weight: bold;
            color: #666;
            min-width: 34px;
            text-align: center;
            user-select: none;
        }

        #${PRICES_ID} td.kr-note {
            color: #888;
            font-style: italic;
            text-align: center;
            padding: 6px 2px;
        }
    `;
    document.head.appendChild(style);

    /* ============================================================
       POMOCNICZE
       ============================================================ */

    // "15333852 / 3" -> "15333852"
    function extractAuftragNumber(text) {
        if (!text) return null;
        const cleaned = text.replace(/\u00a0/g, ' ').trim();
        const firstPart = cleaned.split('/')[0].trim();
        const match = firstPart.match(/\d+/);
        return match ? match[0] : null;
    }

    function normalize(text) {
        return (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // czy użytkownik ma aktywne zaznaczenie wewnątrz podanego elementu?
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
            } catch (e) {
                reject(e);
            } finally {
                ta.remove();
            }
        });
    }

    // wspólny kontener na przypięte panele
    function getStack() {
        let stack = document.getElementById(STACK_ID);
        if (!stack) {
            stack = document.createElement('div');
            stack.id = STACK_ID;
            document.body.appendChild(stack);
        }
        return stack;
    }

    // szkielet panelu: nagłówek + zwijanie
    function createPanelShell(id, title, lsKey) {
        const panel = document.createElement('div');
        panel.id = id;
        panel.className = 'kr-panel';

        const head = document.createElement('div');
        head.className = 'kr-panel-head';
        head.innerHTML = `<span></span><span class="kr-panel-toggle">▾</span>`;
        head.firstChild.textContent = title;

        if (localStorage.getItem(lsKey) === '1') panel.classList.add('kr-collapsed');

        head.addEventListener('click', () => {
            panel.classList.toggle('kr-collapsed');
            localStorage.setItem(lsKey, panel.classList.contains('kr-collapsed') ? '1' : '0');
        });

        panel.appendChild(head);
        return panel;
    }

    // podmienia panel w kontenerze, zachowując kolejność (order w CSS)
    function mountPanel(panel, signature) {
        panel.setAttribute(SIG_ATTR, signature);
        const existing = document.getElementById(panel.id);
        if (existing) {
            existing.replaceWith(panel);
        } else {
            getStack().appendChild(panel);
        }
    }

    /* ============================================================
       0) UNOWOCZEŚNIENIE PRZYCISKÓW STRONY
       ============================================================ */

    // czy kolor tła jest "własnym" kolorem przycisku, a nie systemową szarością?
    function isColorful(color) {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(color || '');
        if (!m) return false;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
        if (alpha === 0) return false;
        return Math.max(r, g, b) - Math.min(r, g, b) > 12;   // odcień, nie szarość
    }

    function modernizeButtons() {
        const selector = 'input[type="button"], input[type="submit"], input[type="reset"], button';
        document.querySelectorAll(selector).forEach(btn => {
            if (btn.classList.contains('kr-btn')) return;                 // już obsłużony
            if (btn.classList.contains('kr-copy-btn')) return;            // nasz własny
            if (btn.closest && btn.closest('#' + STACK_ID)) return;       // przyciski w panelach

            const inlineBg = btn.style && (btn.style.background || btn.style.backgroundColor);
            let computedBg = '';
            try { computedBg = getComputedStyle(btn).backgroundColor; } catch (e) { /* ignore */ }

            const colored = !!inlineBg || isColorful(computedBg);
            btn.classList.add('kr-btn', colored ? 'kr-btn-colored' : 'kr-btn-plain');
        });
    }

    /* ============================================================
       1) PRZYCISK COPY PRZY AUFTRAG #
       ============================================================ */

    function buildCopyButton(getNumber) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kr-copy-btn';
        btn.textContent = 'copy';
        btn.title = 'Kopiuj numer Auftrag (bez pozycji)';

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const number = getNumber();
            if (!number) {
                console.warn(LOG_PREFIX, 'Nie udało się odczytać numeru Auftrag.');
                return;
            }
            copyToClipboard(number).then(() => {
                console.log(LOG_PREFIX, 'Skopiowano:', number);
                btn.textContent = '✓';
                btn.classList.add('kr-copied');
                setTimeout(() => {
                    btn.textContent = 'copy';
                    btn.classList.remove('kr-copied');
                }, 1200);
            }).catch(err => console.error(LOG_PREFIX, 'Błąd kopiowania:', err));
        });

        return btn;
    }

    function addAuftragCopyButtons() {
        document.querySelectorAll('td, th').forEach(labelCell => {
            const label = normalize(labelCell.textContent);
            if (label !== 'Auftrag #' && label !== 'Auftrag#') return;

            let valueCell = labelCell.nextElementSibling;
            if (!valueCell || !extractAuftragNumber(valueCell.textContent)) {
                valueCell = labelCell.querySelector('a') ? labelCell : valueCell;
            }
            if (!valueCell || valueCell.hasAttribute(MARK)) return;

            const link = valueCell.querySelector('a');
            const sourceEl = link || valueCell;
            if (!extractAuftragNumber(sourceEl.textContent)) return;

            const btn = buildCopyButton(() => extractAuftragNumber(sourceEl.textContent));
            if (link && link.parentNode) {
                link.insertAdjacentElement('afterend', btn);
            } else {
                valueCell.appendChild(btn);
            }
            valueCell.setAttribute(MARK, '1');
        });
    }

    /* ============================================================
       2) PANEL Z DANYMI KLIENTA (SHIPPING / BILLING)
       ============================================================ */

    // pola: [etykieta w panelu, etykieta oryginalna na stronie]
    // Phone / Mobile / Email są wspólne dla obu trybów – strona nie rozdziela ich na billing i shipping
    const FIELDS = {
        shipping: [
            ['Company', 'Company (Shipping)'],
            ['Name',    'Name (Shipping)'],
            ['Address', 'Address (Shipping)'],
            ['Phone',   'Phone'],
            ['Mobile',  'Mobile'],
            ['Email',   'Email']
        ],
        billing: [
            ['Company', 'Company (Billing)'],
            ['Name',    'Name (Billing)'],
            ['Address', 'Address (Billing)'],
            ['Phone',   'Phone'],
            ['Mobile',  'Mobile'],
            ['Email',   'Email']
        ]
    };

    function findValueCell(scope, labelText) {
        const cells = scope.querySelectorAll('td, th');
        for (const cell of cells) {
            if (normalize(cell.textContent) === labelText) {
                const next = cell.nextElementSibling;
                if (next) return next;
            }
        }
        return null;
    }

    // numer ticketu z nagłówka strony (fallback: parametry URL)
    function findTicketNumber() {
        const candidates = document.querySelectorAll('h1, h2, h3, h4, b, strong, font, span, div, td');
        for (const el of candidates) {
            const text = normalize(el.textContent);
            if (text.length > 40) continue;          // pomijamy duże kontenery
            const m = text.match(/^Ticket\s*#\s*(\d+)/i);
            if (m) return m[1];
        }
        const params = new URLSearchParams(location.search);
        for (const key of ['ticket_id', 'ticketid', 'ticket', 'id']) {
            const val = params.get(key);
            if (val && /^\d+$/.test(val)) return val;
        }
        return null;
    }

    // numer Auftrag z sekcji Auftrag Details (bez pozycji) wraz z linkiem do orderu
    function findAuftragInfo() {
        const cells = document.querySelectorAll('td, th');
        for (const cell of cells) {
            const label = normalize(cell.textContent);
            if (label !== 'Auftrag #' && label !== 'Auftrag#') continue;
            const valueCell = cell.nextElementSibling;
            if (!valueCell) continue;
            const num = extractAuftragNumber(valueCell.textContent);
            if (!num) continue;
            const link = valueCell.querySelector('a');
            return { number: num, href: link ? link.href : null };
        }
        const params = new URLSearchParams(location.search);
        for (const key of ['auction_number', 'auftrag', 'auction']) {
            const val = params.get(key);
            if (val && /^\d+$/.test(val)) return { number: val, href: null };
        }
        return null;
    }

    // kontener tabeli Customer Data – kotwiczymy się na unikalnej etykiecie
    function findCustomerScope() {
        const cells = document.querySelectorAll('td, th');
        for (const cell of cells) {
            const label = normalize(cell.textContent);
            if (label === 'Address (Shipping)' || label === 'Address (Billing)') {
                return cell.closest('table') || document.body;
            }
        }
        return null;
    }

    function buildTabs() {
        const tabs = document.createElement('div');
        tabs.className = 'kr-tabs';

        [['shipping', 'Shipping'], ['billing', 'Billing']].forEach(([mode, label]) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'kr-tab' + (currentMode === mode ? ' kr-active' : '');
            tab.textContent = label;
            tab.addEventListener('click', (e) => {
                e.stopPropagation();          // klik w zakładkę nie zwija panelu
                if (currentMode === mode) return;
                currentMode = mode;
                localStorage.setItem(LS_MODE, mode);
                buildCustomerPanel(true);     // wymuszona przebudowa
            });
            tabs.appendChild(tab);
        });

        return tabs;
    }

    function buildCustomerPanel(force) {
        const scope = findCustomerScope();
        if (!scope) return;

        const rows = FIELDS[currentMode].map(([label, original]) => ({
            label,
            cell: findValueCell(scope, original)
        }));

        const hasData = rows.some(r => r.cell && normalize(r.cell.textContent));
        if (!hasData) return;

        // identyfikatory na górze panelu
        const auftrag = findAuftragInfo();
        if (auftrag) {
            rows.unshift({
                label: 'Auftrag',
                text: auftrag.number,
                href: auftrag.href,
                copyable: true,
                fullWidth: true
            });
        }

        const ticket = findTicketNumber();
        if (ticket) rows.unshift({ label: 'Ticket', text: '#' + ticket, fullWidth: true });

        // sygnatura treści – panel przebudowujemy TYLKO gdy dane faktycznie się zmieniły.
        // Bez tego licznik czasu w menu bocznym generował mutacje DOM co sekundę,
        // panel był budowany od nowa i gubiło się zaznaczenie tekstu.
        const signature = currentMode + '::' + rows
            .map(r => r.label + '=' + (r.text || (r.cell ? normalize(r.cell.textContent) : '')) + (r.href || ''))
            .join('|');

        const existing = document.getElementById(PANEL_ID);
        if (!force && existing) {
            if (existing.getAttribute(SIG_ATTR) === signature) return;
            if (hasSelectionInside(existing)) return;
        }

        const panel = createPanelShell(PANEL_ID, `Customer Data (${currentMode})`, LS_COLLAPSED);
        panel.appendChild(buildTabs());

        const body = document.createElement('div');
        body.className = 'kr-panel-body';
        const table = document.createElement('table');

        rows.forEach(({ label, cell, text, fullWidth, href, copyable }) => {
            const tr = document.createElement('tr');

            // wiersz na całą szerokość (nr ticketu / nr Auftrag) – wyśrodkowany
            if (fullWidth) {
                const td = document.createElement('td');
                td.className = 'kr-ident';
                td.colSpan = 2;
                td.appendChild(document.createTextNode(label + ' '));

                if (href) {
                    const a = document.createElement('a');
                    a.href = href;
                    a.textContent = text;
                    a.className = 'kr-ident-link';
                    a.title = 'Otwórz Auftrag';
                    td.appendChild(a);
                } else {
                    td.appendChild(document.createTextNode(text));
                }

                if (copyable) {
                    td.appendChild(buildCopyButton(() => extractAuftragNumber(text) || text));
                }

                tr.appendChild(td);
                table.appendChild(tr);
                return;
            }

            const tdLabel = document.createElement('td');
            tdLabel.className = 'kr-label';
            tdLabel.textContent = label;

            const tdValue = document.createElement('td');
            tdValue.className = 'kr-value';

            if (cell && normalize(cell.textContent)) {
                // klonujemy zawartość – dzięki temu linki (Address, Email) zostają aktywne
                Array.from(cell.childNodes).forEach(node => tdValue.appendChild(node.cloneNode(true)));
            } else {
                tdValue.classList.add('kr-empty');
                tdValue.textContent = '–';
            }

            tr.appendChild(tdLabel);
            tr.appendChild(tdValue);
            table.appendChild(tr);
        });

        body.appendChild(table);
        panel.appendChild(body);

        mountPanel(panel, signature);
        console.log(LOG_PREFIX, 'Panel Customer Data odświeżony –', currentMode);
    }

    /* ============================================================
       3) PANEL REAL RETURN SHIPPING PRICES
       ============================================================ */

    const HIDDEN_CLASS = 'kr-hidden-by-script';
    // sekcję na stronie chowamy zawsze – wszystkie dane są w panelu

    // Widoczność liczymy ze stylów poszczególnych przodków, a NIE z wymiarów elementu.
    // Gdy schowamy blok, wszystko w środku ma zerowe wymiary – wcześniej wpadały wtedy
    // do panelu także ukryte wiersze spod "Show all". Kontenery ukryte przez skrypt
    // (klasa HIDDEN_CLASS) pomijamy, resztę sprawdzamy normalnie.
    function isVisible(el) {
        if (!el) return false;
        let node = el;
        while (node && node !== document.body && node.nodeType === 1) {
            if (!node.classList.contains(HIDDEN_CLASS)) {
                const cs = getComputedStyle(node);
                if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            }
            node = node.parentElement;
        }
        return true;
    }

    // UWAGA: dopasowujemy dokładne nazwy kolumn. Wcześniejsze /^shipping price/ łapało też
    // czerwony tytuł "Shipping prices for sending all cartons together", przez co za wiersz
    // nagłówka brany był tytuł i cała tabela zbiorcza czytała się błędnie.
    const HEADER_RE = /^(shipping price|shipping price per 1 piece|real shipping price)$/i;

    function isHeaderRow(row) {
        return Array.from(row.cells).some(c => HEADER_RE.test(normalize(c.textContent)));
    }

    function isPriceTable(table) {
        return Array.from(table.rows || []).some(isHeaderRow);
    }

    function findSectionBounds() {
        let startEl = null;
        let endEl = null;
        document.querySelectorAll('td, th, div, span, b, font').forEach(el => {
            const text = normalize(el.textContent);
            if (text.length > 60) return;
            if (!startEl && /^real return shipping prices$/i.test(text)) startEl = el;
            if (!endEl && /^liquidators.{0,3} prices$/i.test(text)) endEl = el;
        });
        return { startEl, endEl };
    }

    function isBetween(el, startEl, endEl) {
        if (!startEl) return false;
        const afterStart = !!(startEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (!afterStart) return false;
        if (!endEl) return true;
        return !!(endEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
    }

    const PRODUCT_RE = /^\d+\s*x\s*\d+\s*:/;
    const SUMMARY_RE = /^shipping prices for/i;      // np. "Shipping prices for sending all cartons together"

    function cleanGroupTitle(text) {
        return normalize(text).split(/\s*height:/i)[0].split(/\s*Heights added/i)[0].trim();
    }

    // tytuł bloku: zielona belka produktu albo czerwony nagłówek tabeli zbiorczej.
    // Zwracamy ELEMENT, bo jego kolor tła mówi, który wariant wysyłki jest korzystniejszy.
    function findGroupTitleEl(table) {
        for (const row of Array.from(table.rows || [])) {
            for (const cell of Array.from(row.cells)) {
                const text = normalize(cell.textContent);
                if (PRODUCT_RE.test(text) || SUMMARY_RE.test(text)) return cell;
            }
        }
        let node = table;
        for (let depth = 0; node && depth < 6; depth++) {
            let sibling = node.previousElementSibling;
            while (sibling) {
                const text = normalize(sibling.textContent);
                if (PRODUCT_RE.test(text) || SUMMARY_RE.test(text)) return sibling;
                sibling = sibling.previousElementSibling;
            }
            node = node.parentElement;
        }
        return null;
    }

    function isReddish(color) {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '');
        if (!m) return false;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        return r > g + 40 && r > b + 40;
    }

    // czy belka produktu jest zaznaczona na zielono (= korzystniejszy wariant wysyłki)?
    function readTitleStyle(el) {
        if (!el) return { green: false, red: false };
        try {
            const cs = getComputedStyle(el);
            // belka bywa kolorowana na sobie albo na rodzicu (komórka w wierszu tabeli)
            const parentCs = el.parentElement ? getComputedStyle(el.parentElement) : null;
            const green = isGreenish(cs.backgroundColor) ||
                          (parentCs && isGreenish(parentCs.backgroundColor));
            const red = isReddish(cs.color) || isReddish(cs.borderTopColor);
            return { green: !!green, red: !!red };
        } catch (e) {
            return { green: false, red: false };
        }
    }

    // czy kolor jest zielonkawy? (strona zaznacza tak najkorzystniejszą opcję)
    function isGreenish(color) {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '');
        if (!m) return false;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        if (r === 0 && g === 0 && b === 0) return false;
        return g > r + 25 && g > b + 25;
    }

    function isGreenCell(cell) {
        if (!cell) return false;
        try {
            const cs = getComputedStyle(cell);
            return isGreenish(cs.color) || isGreenish(cs.borderTopColor) || isGreenish(cs.backgroundColor);
        } catch (e) {
            return false;
        }
    }

    // mapowanie kolumn na podstawie wiersza nagłówka – tabela zbiorcza ma dodatkową
    // kolumnę "Overall dimensions method", przez którą nazwa spedycji lądowała w złym miejscu
    // linie tekstu z komórki – <br> traktujemy jako podział wiersza,
    // dzięki czemu zapis ceny wygląda tak jak w oryginalnej tabeli
    function cellLines(cell) {
        const clone = cell.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        return clone.textContent
            .split('\n')
            .map(line => normalize(line))
            .filter(Boolean);
    }

    function mapColumns(headerRow) {
        const cells = Array.from(headerRow.cells).map(c => normalize(c.textContent));
        let nameIdx = -1;
        let priceIdx = -1;

        cells.forEach((text, idx) => {
            if (nameIdx === -1 && /^shipping price$/i.test(text)) nameIdx = idx;
            if (/^shipping price per 1 piece$/i.test(text) || /^real shipping price$/i.test(text)) priceIdx = idx;
        });

        if (priceIdx === -1) priceIdx = cells.length - 1;
        if (nameIdx === -1) nameIdx = Math.max(0, priceIdx - 1);
        return { nameIdx, priceIdx };
    }

    // kontener bloku – najwyższy element, którego rodzic zawiera przyciski sekcji
    function blockContainerOf(table, anchorBtn) {
        let node = table;
        while (node.parentElement && anchorBtn && !node.parentElement.contains(anchorBtn)) {
            node = node.parentElement;
        }
        return node;
    }

    function findReturnPriceGroups() {
        const groups = [];
        const { startEl, endEl } = findSectionBounds();
        if (!startEl) return groups;

        const anchorBtn = findReturnPricesButton();

        const tables = Array.from(document.querySelectorAll('table')).filter(t =>
            isPriceTable(t) && isVisible(t) && isBetween(t, startEl, endEl)
        );

        tables.forEach(table => {
            // tylko tabele najgłębsze – opakowania pomijamy
            if (Array.from(table.querySelectorAll('table')).some(inner => tables.includes(inner))) return;

            const rows = Array.from(table.rows || []);
            const headerIdx = rows.findIndex(isHeaderRow);
            if (headerIdx === -1) return;

            const { nameIdx, priceIdx } = mapColumns(rows[headerIdx]);

            const items = [];
            rows.slice(headerIdx + 1).forEach(row => {
                if (!isVisible(row)) return;
                const cells = Array.from(row.cells);
                if (cells.length < 3) return;

                const priceCell = cells[priceIdx] || cells[cells.length - 1];
                const nameCell = cells[nameIdx] || cells[cells.length - 2];
                if (!priceCell || !nameCell) return;

                const priceLines = cellLines(priceCell);
                const priceText = priceLines.join(' ');
                if (!/\d/.test(priceText)) return;

                const nameText = normalize(nameCell.textContent);
                if (!nameText || PRODUCT_RE.test(nameText)) return;

                const idCell = cells[0];
                const idText = normalize(idCell.textContent);
                const idLink = idCell.querySelector('a');

                let country = '';
                if (cells.length >= 4) {
                    const c = normalize(cells[1].textContent);
                    if (c.length <= 3) country = c;
                }

                const firstNumber = (priceLines[0] || priceText).match(/[\d]+[.,]?[\d]*/);
                const value = firstNumber ? parseFloat(firstNumber[0].replace(',', '.')) : NaN;

                items.push({
                    id: /^\d+$/.test(idText) ? idText : '',
                    idHref: idLink ? idLink.href : null,
                    country,
                    name: nameText,
                    price: priceText,
                    priceLines,
                    value: isNaN(value) ? null : value,
                    green: isGreenCell(priceCell) || isGreenCell(row)
                });
            });

            if (!items.length) return;

            const titleEl = findGroupTitleEl(table);
            const titleStyle = readTitleStyle(titleEl);

            groups.push({
                title: titleEl ? cleanGroupTitle(titleEl.textContent) : null,
                titleGreen: titleStyle.green,
                titleRed: titleStyle.red,
                items,
                container: blockContainerOf(table, anchorBtn)
            });
        });

        return groups;
    }

    /* ---------- chowanie oryginalnej sekcji na stronie ---------- */

    function applySectionVisibility(groups) {
        groups.forEach(g => {
            if (!g.container || g.container.classList.contains(HIDDEN_CLASS)) return;
            g.container.classList.add(HIDDEN_CLASS);
            g.container.style.display = 'none';
        });
    }

    /* ---------- automatyczne doładowanie sekcji ---------- */

    let autoLoadAttempts = 0;
    let autoLoadTimer = null;
    const AUTOLOAD_MAX = 12;

    function findReturnPricesButton() {
        const candidates = document.querySelectorAll('input[type="button"], input[type="submit"], button, a');
        for (const btn of candidates) {
            const label = normalize(btn.value || btn.textContent);
            if (/^return prices$/i.test(label)) return btn;
        }
        return null;
    }

    function clickReturnPrices(btn) {
        // niektóre handlery reagują dopiero na pełną sekwencję zdarzeń myszy
        try {
            ['mousedown', 'mouseup', 'click'].forEach(type => {
                btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            });
        } catch (e) {
            console.warn(LOG_PREFIX, 'Zdarzenia myszy nieudane:', e);
        }
        if (typeof btn.click === 'function') btn.click();
        if (typeof btn.onclick === 'function') {
            try { btn.onclick.call(btn); } catch (e) { /* handler mógł już zadziałać */ }
        }
    }

    function startAutoLoad() {
        if (autoLoadTimer) return;
        autoLoadTimer = setInterval(() => {
            if (findReturnPriceGroups().length) {
                clearInterval(autoLoadTimer);
                autoLoadTimer = null;
                buildPricesPanel(false);
                return;
            }
            if (autoLoadAttempts >= AUTOLOAD_MAX) {
                clearInterval(autoLoadTimer);
                autoLoadTimer = null;
                console.log(LOG_PREFIX, 'Nie udało się automatycznie załadować cen zwrotów.');
                return;
            }
            const btn = findReturnPricesButton();
            if (!btn) return;
            autoLoadAttempts++;
            console.log(LOG_PREFIX, 'Ładowanie Real Return Shipping Prices – próba', autoLoadAttempts);
            clickReturnPrices(btn);
        }, 900);
    }

    function ensurePricesLoaded(hasGroups) {
        if (hasGroups) {
            if (autoLoadTimer) { clearInterval(autoLoadTimer); autoLoadTimer = null; }
            return;
        }
        startAutoLoad();
    }

    /* ---------- budowa panelu ---------- */

    function buildPricesPanel(force) {
        const groups = findReturnPriceGroups();
        if (!groups.length) {
            const stale = document.getElementById(PRICES_ID);
            if (stale) stale.remove();
            return false;
        }

        applySectionVisibility(groups);

        const signature = groups
            .map(g => (g.title || '') + (g.titleGreen ? '#G' : '') + (g.titleRed ? '#R' : '') + '>' +
                      g.items.map(i => i.id + i.name + '=' + i.price + (i.green ? '*' : '')).join('|'))
            .join('||');

        const existing = document.getElementById(PRICES_ID);
        if (!force && existing) {
            if (existing.getAttribute(SIG_ATTR) === signature) return true;
            if (hasSelectionInside(existing)) return true;
        }

        const panel = createPanelShell(PRICES_ID, 'Real Return Prices', LS_PRICES_COLLAPSED);

        const body = document.createElement('div');
        body.className = 'kr-panel-body kr-prices-body';

        // każdy blok cen to osobny "slajd" – przewijany w bok
        const scroller = document.createElement('div');
        scroller.className = 'kr-scroller';

        groups.forEach((group, idx) => {
            const slide = document.createElement('div');
            slide.className = 'kr-slide';

            const title = document.createElement('div');
            title.className = 'kr-slide-title';
            if (group.titleGreen) {
                title.classList.add('kr-slide-title-green');       // korzystniejszy wariant wysyłki
            } else if (group.titleRed || (group.title && SUMMARY_RE.test(group.title))) {
                title.classList.add('kr-slide-title-summary');
            }
            title.textContent = group.title || ('Blok ' + (idx + 1));
            slide.appendChild(title);

            const table = document.createElement('table');

            // Szerokość kolumny z ceną liczymy z najdłuższej linii – rynki z rozpisanym
            // działaniem (np. HU: "23.36 EUR (=15.74 EUR + 7.62 EUR)") potrzebują więcej miejsca,
            // inaczej linia łamie się w pionową drabinkę.
            let mainChars = 0;
            let altChars = 0;
            group.items.forEach(i => {
                const lines = i.priceLines && i.priceLines.length ? i.priceLines : [i.price];
                mainChars = Math.max(mainChars, lines[0].length);
                lines.slice(1).forEach(l => { altChars = Math.max(altChars, l.length); });
            });
            const priceWidth = Math.min(200, Math.max(64, Math.ceil(Math.max(mainChars * 6.1, altChars * 5.0)) + 6));

            const colgroup = document.createElement('colgroup');
            [30, null, priceWidth].forEach(w => {
                const col = document.createElement('col');
                if (w) col.style.width = w + 'px';
                colgroup.appendChild(col);
            });
            table.appendChild(colgroup);

            // wyróżnienie: najpierw to, co strona zaznaczyła na zielono; w razie braku – najniższa cena
            const hasGreen = group.items.some(i => i.green);
            const prices = group.items.map(i => i.value).filter(v => v !== null);
            const min = prices.length ? Math.min(...prices) : null;

            group.items.forEach(item => {
                const tr = document.createElement('tr');
                const highlight = hasGreen ? item.green : (min !== null && item.value === min);
                if (highlight) tr.className = 'kr-cheapest';

                const tdId = document.createElement('td');
                tdId.className = 'kr-price-id';
                if (item.id && item.idHref) {
                    const a = document.createElement('a');
                    a.href = item.idHref;
                    a.textContent = item.id;
                    tdId.appendChild(a);
                } else {
                    tdId.textContent = item.id;
                }

                const tdName = document.createElement('td');
                tdName.className = 'kr-price-name';
                if (item.country) {
                    const c = document.createElement('span');
                    c.className = 'kr-country';
                    c.textContent = item.country;
                    tdName.appendChild(c);
                }
                tdName.appendChild(document.createTextNode(item.name));

                const tdPrice = document.createElement('td');
                tdPrice.className = 'kr-price-value';
                // pierwsza linia = cena główna, kolejne (druga waluta, rozbicie) mniejszą czcionką
                const lines = item.priceLines && item.priceLines.length ? item.priceLines : [item.price];
                tdPrice.appendChild(document.createTextNode(lines[0]));
                lines.slice(1).forEach(line => {
                    const alt = document.createElement('span');
                    alt.className = 'kr-price-alt';
                    alt.textContent = line;
                    tdPrice.appendChild(alt);
                });

                tr.appendChild(tdId);
                tr.appendChild(tdName);
                tr.appendChild(tdPrice);
                table.appendChild(tr);
            });

            slide.appendChild(table);
            scroller.appendChild(slide);
        });

        body.appendChild(scroller);

        // nawigacja w bok – tylko gdy jest więcej niż jeden blok
        if (groups.length > 1) {
            const nav = document.createElement('div');
            nav.className = 'kr-nav';

            const prev = document.createElement('button');
            prev.type = 'button';
            prev.className = 'kr-nav-btn';
            prev.textContent = '‹';

            const counter = document.createElement('span');
            counter.className = 'kr-nav-counter';
            counter.textContent = '1 / ' + groups.length;

            const next = document.createElement('button');
            next.type = 'button';
            next.className = 'kr-nav-btn';
            next.textContent = '›';

            const slideIndex = () => Math.round(scroller.scrollLeft / scroller.clientWidth);
            const goTo = (idx) => {
                const target = Math.max(0, Math.min(groups.length - 1, idx));
                scroller.scrollTo({ left: target * scroller.clientWidth, behavior: 'smooth' });
            };

            prev.addEventListener('click', (e) => { e.stopPropagation(); goTo(slideIndex() - 1); });
            next.addEventListener('click', (e) => { e.stopPropagation(); goTo(slideIndex() + 1); });

            scroller.addEventListener('scroll', () => {
                counter.textContent = (slideIndex() + 1) + ' / ' + groups.length;
            });

            nav.appendChild(prev);
            nav.appendChild(counter);
            nav.appendChild(next);
            body.appendChild(nav);
        }

        panel.appendChild(body);

        mountPanel(panel, signature);
        console.log(LOG_PREFIX, 'Panel Real Return Prices odświeżony –', groups.length, 'blok(ów)');
        return true;
    }

    /* ============================================================
       START + OBSERWATOR DOM
       ============================================================ */

    function run() {
        modernizeButtons();
        addAuftragCopyButtons();
        buildCustomerPanel(false);
        const hasPrices = buildPricesPanel(false);
        ensurePricesLoaded(hasPrices);
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

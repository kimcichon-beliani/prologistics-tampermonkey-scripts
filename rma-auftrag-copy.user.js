// ==UserScript==
// @name         Prologistics – RMA Auftrag # Copy + Customer Panel
// @namespace    kimrioter
// @version      1.6.0
// @description  1) Przycisk "copy" obok numeru Auftrag (kopiuje sam numer, bez pozycji). 2) Przypięta w prawym górnym rogu tabelka z nr ticketu, nr Auftrag i danymi klienta – z przełącznikiem Shipping / Billing.
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
    const PANEL_ID = 'kr-customer-panel';
    const SIG_ATTR = 'data-kr-signature';       // sygnatura treści panelu
    const LS_COLLAPSED = 'kr_customer_panel_collapsed';
    const LS_MODE = 'kr_customer_panel_mode';   // 'shipping' | 'billing'

    // aktualnie wybrany tryb
    let currentMode = localStorage.getItem(LS_MODE) === 'billing' ? 'billing' : 'shipping';

    /* ============================================================
       STYLE
       ============================================================ */
    const style = document.createElement('style');
    style.textContent = `
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

        /* --- przypięty panel --- */
        #${PANEL_ID} {
            position: fixed;
            top: 12px;
            right: 100px;  /* odsunięte w lewo, żeby nie nachodziło na przycisk dark mode */
            z-index: 99999;
            width: 300px;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            background: #fff;
            border: 1px solid ${BRAND};
            border-radius: 4px;
            box-shadow: 0 3px 10px rgba(0,0,0,.25);
            overflow: hidden;
        }
        #${PANEL_ID} .kr-panel-head {
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
        #${PANEL_ID} .kr-panel-toggle {
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
        #${PANEL_ID}.kr-collapsed .kr-panel-toggle { transform: rotate(-90deg); }

        /* --- zakładki Shipping / Billing --- */
        #${PANEL_ID} .kr-tabs {
            display: flex;
            border-bottom: 1px solid #ddd;
            background: #f2f2f2;
        }
        #${PANEL_ID} .kr-tab {
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
        #${PANEL_ID} .kr-tab:hover { background: #e8e8e8; color: #333; }
        #${PANEL_ID} .kr-tab.kr-active {
            color: ${BRAND};
            background: #fff;
            border-bottom-color: ${BRAND};
        }

        #${PANEL_ID} .kr-panel-body { padding: 6px 8px 8px; }
        #${PANEL_ID}.kr-collapsed .kr-panel-body,
        #${PANEL_ID}.kr-collapsed .kr-tabs { display: none; }

        #${PANEL_ID} table { border-collapse: collapse; width: 100%; }
        #${PANEL_ID} td {
            padding: 3px 2px;
            vertical-align: top;
            border-bottom: 1px solid #eee;
            word-break: break-word;
        }
        #${PANEL_ID} tr:last-child td { border-bottom: none; }
        #${PANEL_ID} td.kr-label {
            width: 72px;
            font-weight: bold;
            color: #333;
            white-space: nowrap;
        }
        #${PANEL_ID} td.kr-value {
            color: #000;
            user-select: text;
            cursor: text;
        }
        #${PANEL_ID} td.kr-value a { color: #0645ad; text-decoration: none; }
        #${PANEL_ID} td.kr-value a:hover { text-decoration: underline; }
        #${PANEL_ID} td.kr-value.kr-empty { color: #aaa; }
        #${PANEL_ID} td.kr-ident .kr-ident-link {
            color: ${BRAND};
            text-decoration: none;
            border-bottom: 1px dotted ${BRAND};
        }
        #${PANEL_ID} td.kr-ident .kr-ident-link:hover { text-decoration: none; border-bottom-style: solid; }
        #${PANEL_ID} td.kr-ident .kr-copy-btn {
            height: 14px;
            min-width: 20px;
            font-size: 9px;
            margin-left: 5px;
        }
        #${PANEL_ID} td.kr-ident {
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
       2) PRZYPIĘTY PANEL Z DANYMI KLIENTA
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

    // znajduje komórkę wartości dla podanej etykiety (w obrębie kontenera)
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

    // wyciąga numer ticketu z nagłówka strony (fallback: parametry URL)
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

    // wyciąga numer Auftrag z sekcji Auftrag Details (bez pozycji) wraz z linkiem do orderu
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

    // ustala kontener tabeli Customer Data – kotwiczymy się na unikalnej etykiecie
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

    function buildTabs(panel) {
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

    function buildPanel(rows) {
        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        const head = document.createElement('div');
        head.className = 'kr-panel-head';
        head.innerHTML = `<span>Customer Data (${currentMode})</span><span class="kr-panel-toggle">▾</span>`;

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
                    // numer jako link do strony orderu – zaznaczanie tekstu nadal działa
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
                Array.from(cell.childNodes).forEach(node => {
                    tdValue.appendChild(node.cloneNode(true));
                });
            } else {
                tdValue.classList.add('kr-empty');
                tdValue.textContent = '–';
            }

            tr.appendChild(tdLabel);
            tr.appendChild(tdValue);
            table.appendChild(tr);
        });

        body.appendChild(table);
        panel.appendChild(head);
        panel.appendChild(buildTabs(panel));
        panel.appendChild(body);

        // zwijanie / rozwijanie – stan zapamiętany w localStorage.
        // Strzałka to zawsze ten sam znak; kierunek robi CSS-owy obrót, więc nic nie skacze.
        if (localStorage.getItem(LS_COLLAPSED) === '1') {
            panel.classList.add('kr-collapsed');
        }
        head.addEventListener('click', () => {
            panel.classList.toggle('kr-collapsed');
            const collapsed = panel.classList.contains('kr-collapsed');
            localStorage.setItem(LS_COLLAPSED, collapsed ? '1' : '0');
        });

        return panel;
    }

    function buildCustomerPanel(force) {
        const scope = findCustomerScope();
        if (!scope) return;

        const rows = FIELDS[currentMode].map(([label, original]) => ({
            label,
            cell: findValueCell(scope, original)
        }));

        // jeśli nie ma żadnych danych – nie pokazujemy pustego panelu
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
            // nie ruszamy panelu, gdy użytkownik właśnie zaznacza w nim tekst
            if (hasSelectionInside(existing)) return;
        }

        const panel = buildPanel(rows);
        panel.setAttribute(SIG_ATTR, signature);

        if (existing) existing.remove();
        document.body.appendChild(panel);
        console.log(LOG_PREFIX, 'Panel Customer Data odświeżony –', currentMode);
    }

    /* ============================================================
       START + OBSERWATOR DOM
       ============================================================ */

    function run() {
        addAuftragCopyButtons();
        buildCustomerPanel(false);
    }

    run();

    let timer = null;
    const observer = new MutationObserver(mutations => {
        // ignorujemy zmiany wywołane przez sam panel
        const relevant = mutations.some(m => {
            const t = m.target;
            return !(t.closest && t.closest('#' + PANEL_ID));
        });
        if (!relevant) return;

        clearTimeout(timer);
        timer = setTimeout(run, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();

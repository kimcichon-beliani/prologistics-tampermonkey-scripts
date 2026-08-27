// ==UserScript==
// @name         Prologistics – Employees Column Manager
// @namespace    kimrioter
// @version      1.8.2
// @description  Ukrywanie/pokazywanie wybranych kolumn w tabeli Employees na prologistics.info
// @author       kimrioter
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-employees-column-manager.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-employees-column-manager.user.js
// @match        https://www.prologistics.info/react/settings_page/employees*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ZASADA: nie dotykamy niczego, co należy do Reacta.
    //  - panel wisi w <html>, nie w <body> (body bywa kontenerem roota Reacta)
    //  - panel jest w Shadow DOM, więc style strony i nasze nie mieszają się
    //  - nie dopisujemy żadnych atrybutów do tabeli ani jej komórek
    //  - jedyna ingerencja w stronę to <style> w <head> z regułami nth-child

    const VERSION = '1.8.2';
    const LOG = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const STORAGE_KEY = 'tm_kimrioter_employees_hidden_cols';
    const WIDTH_KEY = 'tm_kimrioter_employees_autowidth';

    const PRESET = [
        'Department abbrev.',
        'Monitoring',
        'Username',
        'Tel. intern',
        'Alias Name Beliani/STM',
        'User email',
        'Tel. Mobile Private',
        'Tel. Mobile DE',
        'Tel. Mobile CH',
        'Tel. Home'
    ];

    // ---------------------------------------------------------------- pomocnicze

    const norm = (s) => s.toLowerCase().replace(/[\s.,\/\-()]+/g, '');

    const clean = (s) =>
        s.replace(/[▼▲△▽↑↓⯅⯆⌃⌄]/g, '')
         .replace(/clear\s*clipboard/gi, '')
         .replace(/\s+/g, ' ')
         .trim();

    function loadHidden() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch (e) {
            return new Set();
        }
    }

    function saveHidden(set) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
        } catch (e) {
            console.warn(LOG, 'Zapis ustawień nieudany:', e);
        }
    }

    let hidden = loadHidden();
    let autoWidth = localStorage.getItem(WIDTH_KEY) !== '0';
    let currentTable = null;
    let currentLabels = [];
    let panelOpen = false;
    let host = null;
    let root = null;   // shadowRoot

    // ---------------------------------------------------------------- tabela

    // Strona stoi na tabeli układu, a siatka Employees jest w niej zagnieżdżona.
    // querySelectorAll('th') liczy też potomków, więc tabela zewnętrzna miała tyle
    // samo nagłówków i wygrywała – ukrywanie szło wtedy po komórkach układu strony.
    // Liczymy WYŁĄCZNIE nagłówki należące do samej tabeli i pomijamy tabele-kontenery.
    function ownCells(table, sel) {
        return [...table.querySelectorAll(sel)].filter((el) => el.closest('table') === table);
    }

    function findTable() {
        let best = null;
        let bestCount = 0;
        document.querySelectorAll('table').forEach((t) => {
            if (t.querySelector('table')) return;        // tabela układu – pomijamy
            const n = ownCells(t, 'th').length;
            if (n > bestCount) {
                best = t;
                bestCount = n;
            }
        });
        return bestCount >= 3 ? best : null;
    }

    function readLabels(table) {
        const rows = ownCells(table, 'thead tr');
        let headRow = null;
        rows.forEach((r) => {
            if (!headRow || r.cells.length > headRow.cells.length) headRow = r;
        });
        if (!headRow && table.rows.length) headRow = table.rows[0];
        if (!headRow) return [];

        return [...headRow.cells].map((cell, i) => {
            const base = cell.cloneNode(true);
            base.querySelectorAll('input, select, svg').forEach((el) => el.remove());
            const full = clean(base.textContent);

            const noBtn = base.cloneNode(true);
            noBtn.querySelectorAll('button, .btn, [role="button"]').forEach((el) => el.remove());
            const short = clean(noBtn.textContent);

            return short || full || `Kolumna ${i + 1}`;
        });
    }

    // ---------------------------------------------------------------- ukrywanie kolumn

    // Sprzątanie po wersjach <= 1.5.0: globalny <style> potrafił ukrywać kolumny
    // w tabelach układu strony i wygaszał pół dokumentu.
    function dropLegacyStyle() {
        const el = document.getElementById('tm-cols-style');
        if (el) el.remove();
    }

    // Tabela układu (zawiera w sobie inną tabelę) nigdy nie jest celem
    function isDataTable(table) {
        return !!table && !table.querySelector('table');
    }

    // Ukrywamy WYŁĄCZNIE komórki wskazanej tabeli, ustawiając styl na konkretnym
    // elemencie. Nic poza tą tabelą nie może zostać dotknięte.
    function applyHiding() {
        dropLegacyStyle();
        if (!currentTable || !currentTable.isConnected) return;

        if (!isDataTable(currentTable)) {
            console.warn(LOG, 'Wybrana tabela zawiera zagnieżdżoną tabelę – ukrywanie wstrzymane');
            return;
        }

        const hideIdx = new Set();
        currentLabels.forEach((label, i) => {
            if (hidden.has(norm(label))) hideIdx.add(i);
        });

        const rows = currentTable.querySelectorAll(
            ':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr'
        );

        let touched = 0;
        rows.forEach((row) => {
            const cells = row.querySelectorAll(':scope > th, :scope > td');
            cells.forEach((cell, i) => {
                const shouldHide = hideIdx.has(i);
                const isHidden = cell.style.getPropertyValue('display') === 'none';
                if (shouldHide) {
                    if (!isHidden) {
                        // !important, bo arkusz strony wymusza display:table-cell
                        cell.style.setProperty('display', 'none', 'important');
                        touched++;
                    }
                } else if (isHidden) {
                    cell.style.removeProperty('display');
                    touched++;
                }
            });
        });

        applyWidths();

        console.log(LOG, 'applyHiding →',
            'ukrywane indeksy:', [...hideIdx],
            '| wierszy:', rows.length,
            '| zmienionych komorek:', touched,
            '| tabela:', currentTable.offsetWidth + 'x' + currentTable.offsetHeight,
            currentTable.className || '(brak klasy)');
    }

    // Tylko te kolumny dopasowują się do treści – reszta zostaje jak była.
    const AUTO_COLS = ['Email', 'Teams'];
    const MAX_COL_PX = 320;   // górny limit, żeby jeden długi adres nie rozjechał tabeli

    // scrollWidth na komórce z overflow:visible zwraca szerokość widoczną, nie realną
    // szerokość tekstu. Range mierzy faktyczny obrys treści, także gdy wystaje.
    function contentWidth(cell) {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const w = range.getBoundingClientRect().width;
        range.detach && range.detach();

        const cs = getComputedStyle(cell);
        const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
                    parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        return Math.ceil(w + pad) + 6;
    }

    function applyWidths() {
        const t = currentTable;
        if (!t || !t.isConnected) return;

        const targetIdx = [];
        currentLabels.forEach((label, i) => {
            if (AUTO_COLS.some((n) => norm(n) === norm(label))) targetIdx.push(i);
        });
        if (!targetIdx.length) return;

        const rows = [...t.querySelectorAll(
            ':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr'
        )];
        if (!rows.length) return;

        const cols = ownCells(t, 'col');

        targetIdx.forEach((idx) => {
            const cells = rows
                .map((row) => row.querySelectorAll(':scope > th, :scope > td')[idx])
                .filter((c) => c && c.style.getPropertyValue('display') !== 'none');
            if (!cells.length) return;

            const col = cols[idx];

            if (!autoWidth) {
                t.style.removeProperty('table-layout');
                t.style.removeProperty('width');
                rows.forEach((row) => {
                    row.querySelectorAll(':scope > th, :scope > td').forEach((c) => {
                        c.style.removeProperty('white-space');
                        c.style.removeProperty('width');
                        c.style.removeProperty('min-width');
                        c.style.removeProperty('overflow');
                        c.style.removeProperty('text-overflow');
                    });
                });
                if (col) col.style.removeProperty('width');
                return;
            }

            cells.forEach((c) => {
                if (c.style.getPropertyValue('white-space') !== 'nowrap') {
                    c.style.setProperty('white-space', 'nowrap', 'important');
                }
            });

            let need = 0;
            cells.forEach((c) => { need = Math.max(need, contentWidth(c)); });
            need = Math.min(need, MAX_COL_PX);
            const px = need + 'px';

            // Przy table-layout:fixed o szerokości decyduje <col>, jeśli tabela go ma
            if (col && col.style.getPropertyValue('width') !== px) {
                col.style.setProperty('width', px, 'important');
            }

            cells.forEach((c) => {
                c.style.setProperty('width', px, 'important');
                c.style.setProperty('min-width', px, 'important');
                c.style.setProperty('overflow', 'hidden', 'important');
                c.style.setProperty('text-overflow', 'ellipsis', 'important');
            });

            // Sprawdzamy, czy kolumna faktycznie urosła. Jeśli nie – o szerokości
            // decyduje algorytm tabeli, więc przypinamy pozostałe kolumny do ich
            // obecnych szerokości i przełączamy tabelę na layout automatyczny.
            const head = cells[0];
            const grew = head.offsetWidth + 3 >= need;

            console.log(LOG, 'szerokość kolumny', currentLabels[idx],
                '| potrzeba:', need,
                '| po ustawieniu:', head.offsetWidth,
                '| <col>:', !!col,
                '| layout:', getComputedStyle(t).tableLayout,
                grew ? '| OK' : '| NIE ZADZIAŁAŁO – plan B');

            if (!grew) forceAutoLayout(t, rows, targetIdx, idx, need);
        });
    }

    // Plan B: usztywniamy wszystkie pozostałe kolumny na ich obecnych szerokościach,
    // przełączamy tabelę na layout automatyczny i dopiero wtedy poszerzamy docelową.
    function forceAutoLayout(t, rows, targetIdx, idx, need) {
        const headRow = rows[0];
        if (!headRow) return;
        const headCells = [...headRow.querySelectorAll(':scope > th, :scope > td')];

        headCells.forEach((c, i) => {
            if (i === idx) return;
            if (c.style.getPropertyValue('display') === 'none') return;
            if (!c.style.getPropertyValue('width')) {
                c.style.setProperty('width', c.offsetWidth + 'px', 'important');
            }
        });

        t.style.setProperty('table-layout', 'auto', 'important');
        t.style.setProperty('width', 'auto', 'important');

        const target = headCells[idx];
        if (target) {
            target.style.setProperty('width', need + 'px', 'important');
            target.style.setProperty('min-width', need + 'px', 'important');
        }

        console.log(LOG, 'plan B zastosowany dla', currentLabels[idx],
            '→', target ? target.offsetWidth : '?');
    }

    // ---------------------------------------------------------------- panel UI

    const PANEL_CSS = `
        :host{all:initial;}
        .wrap{position:absolute;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;font-size:13px;}
        #toggle{background:${BRAND};color:#fff;border:0;border-radius:6px;padding:7px 12px;white-space:nowrap;line-height:1.2;
            cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:13px;font-family:inherit;}
        #toggle:hover{filter:brightness(1.15);}
        #box{position:absolute;top:calc(100% + 6px);left:0;width:260px;white-space:normal;max-height:70vh;
            display:flex;flex-direction:column;background:#fff;color:#222;border:1px solid #ccc;
            border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);overflow:hidden;}
        #box[hidden]{display:none;}
        .head{display:flex;justify-content:space-between;align-items:center;background:${BRAND};
            color:#fff;padding:8px 10px;font-weight:bold;}
        .head button{background:transparent;border:0;color:#fff;cursor:pointer;font-size:15px;line-height:1;}
        .actions{display:flex;gap:6px;padding:8px;border-bottom:1px solid #eee;}
        .opt{display:flex;align-items:center;gap:8px;padding:7px 10px;color:#222;border-bottom:1px solid #eee;cursor:pointer;}
        .opt input{margin:0;cursor:pointer;}
        .actions button{flex:1;background:#f2f2f2;border:1px solid #ccc;border-radius:4px;padding:5px 4px;
            cursor:pointer;font-size:12px;color:#222;font-family:inherit;}
        .actions button:hover{background:#e4e4e4;}
        #list{overflow-y:auto;padding:6px 8px;}
        #list label{display:flex;align-items:center;gap:8px;padding:4px 2px;cursor:pointer;
            border-radius:4px;line-height:1.25;color:#222;}
        #list label:hover{background:#f5f5f5;}
        #list input{cursor:pointer;margin:0;flex:0 0 auto;}
        .foot{padding:6px 10px;border-top:1px solid #eee;color:#666;font-size:11px;}`;

    function findAnchor() {
        const btns = [...document.querySelectorAll('button, input[type="button"], input[type="submit"]')];
        return btns.find((b) => /^\s*filter\s*$/i.test(b.textContent || b.value || '')) || null;
    }

    function reposition() {
        if (!root) return;
        const wrap = root.querySelector('.wrap');
        if (!wrap) return;

        const anchor = findAnchor();
        if (anchor) {
            const r = anchor.getBoundingClientRect();
            wrap.style.position = 'absolute';
            wrap.style.left = (r.right + window.scrollX + 12) + 'px';
            wrap.style.top = (r.top + window.scrollY) + 'px';
            wrap.style.right = 'auto';
        } else {
            wrap.style.position = 'fixed';
            wrap.style.top = '90px';
            wrap.style.left = '16px';
            wrap.style.right = 'auto';
        }
    }

    function setOpen(state) {
        panelOpen = state;
        const box = root && root.getElementById('box');
        if (box) box.hidden = !state;
    }

    function ensurePanel() {
        if (host && host.isConnected) {
            reposition();
            return;
        }

        host = document.createElement('div');
        host.id = 'tm-cols-host';
        host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483000;';
        // <html>, nie <body> – body może być kontenerem roota Reacta
        document.documentElement.appendChild(host);

        root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `
            <style>${PANEL_CSS}</style>
            <div class="wrap">
                <button type="button" id="toggle" title="Widoczność kolumn">☰ Kolumny</button>
                <div id="box" hidden>
                    <div class="head"><span>Widoczność kolumn</span>
                        <button type="button" id="close" title="Zamknij">✕</button></div>
                    <div class="actions">
                        <button type="button" data-act="all">Pokaż wszystkie</button>
                        <button type="button" data-act="preset">Ukryj zbędne</button>
                    </div>
                    <label class="opt"><input type="checkbox" id="autow">Szersze Email i Teams</label>
                    <div id="list"></div>
                    <div class="foot"><span id="count"></span></div>
                </div>
            </div>`;

        // Nasłuchy wewnątrz shadow roota – React nie ma tu dostępu, nic ich nie usunie
        root.getElementById('toggle').addEventListener('click', () => setOpen(!panelOpen));
        root.getElementById('close').addEventListener('click', () => setOpen(false));

        const aw = root.getElementById('autow');
        aw.checked = autoWidth;
        aw.addEventListener('change', () => {
            autoWidth = aw.checked;
            localStorage.setItem(WIDTH_KEY, autoWidth ? '1' : '0');
            applyWidths();
        });
        root.querySelectorAll('.actions button').forEach((b) => {
            b.addEventListener('click', () => {
                if (b.dataset.act === 'all') hidden.clear();
                else PRESET.forEach((name) => hidden.add(norm(name)));
                saveHidden(hidden);
                applyHiding();
                renderList();
            });
        });

        setOpen(panelOpen);
        reposition();
    }

    function renderList() {
        if (!root) return;
        const list = root.getElementById('list');
        if (!list) return;
        list.innerHTML = '';

        currentLabels.forEach((label) => {
            const key = norm(label);
            const row = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !hidden.has(key);
            cb.addEventListener('change', () => {
                if (cb.checked) hidden.delete(key);
                else hidden.add(key);
                saveHidden(hidden);
                applyHiding();
                updateCount();
            });
            row.appendChild(cb);
            row.appendChild(document.createTextNode(label));
            list.appendChild(row);
        });

        updateCount();
    }

    function updateCount() {
        if (!root) return;
        const el = root.getElementById('count');
        if (!el) return;
        const off = currentLabels.filter((l) => hidden.has(norm(l))).length;
        el.textContent = `Ukryte: ${off} z ${currentLabels.length} · v${VERSION}`;
    }

    // ---------------------------------------------------------------- odświeżanie

    function refresh() {
        const table = findTable();
        if (!table) return;   // brak tabeli = nie budujemy panelu

        const labels = readLabels(table);
        if (!labels.length) return;

        const changed =
            table !== currentTable ||
            labels.length !== currentLabels.length ||
            labels.some((l, i) => l !== currentLabels[i]);

        currentTable = table;
        currentLabels = labels;
        applyHiding();
        ensurePanel();

        if (changed || !(root && root.querySelector('#list label'))) {
            renderList();
            if (changed) console.log(LOG, 'Employees – kolumny:', labels.join(' | '));
        }
    }

    // Klik poza panelem zamyka listę (composedPath, bo panel jest w Shadow DOM)
    document.addEventListener('click', (e) => {
        if (!panelOpen || !host) return;
        if (!e.composedPath().includes(host)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelOpen) setOpen(false);
    });
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);

    let timer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(refresh, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    refresh();

    console.log(LOG, 'Employees Column Manager v' + VERSION + ' załadowany');
})();

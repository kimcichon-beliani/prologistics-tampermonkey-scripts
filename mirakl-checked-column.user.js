// ==UserScript==
// @name         Mirakl – "Checked?" przy zamówieniach
// @namespace    beliani
// @version      1.9
// @description  Dodaje checkbox "Checked?" po lewej stronie kolumny Order ID na listach zamówień w Mirakl i zapamiętuje zaznaczenia po odświeżeniu
// @match        *://*/mmp/shop/*
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/mirakl-checked-column.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/mirakl-checked-column.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

// Skrypt odpala się na KAŻDEJ domenie, ale tylko pod ścieżką /mmp/shop/ (standardowa ścieżka
// panelu sprzedawcy Mirakl), więc nie trzeba dopisywać osobnej reguły dla każdego partnera.
//
// Nie dodajemy nowej kolumny (to rozjeżdżało układ tabeli Mirakla). Zamiast tego w kolumnie
// Order ID robimy miejsce po lewej – w nagłówku na napis "Checked?", w wierszach na checkbox.

(function () {
    'use strict';

    // ====== USTAWIENIA ======
    const COLUMN_TITLE = 'Checked?';
    const LEFT_SPACE = 68;                           // px miejsca po lewej w kolumnie Order ID
    const BOX_LEFT = 8;                              // odległość od lewej krawędzi komórki
    const BOX_WIDTH = 56;                            // szerokość pola z napisem/checkboxem (LEFT_SPACE > BOX_LEFT + BOX_WIDTH)
    const HEADER_FIRST_TEXT = 'Order ID';            // tytuły dwóch kolumn z nagłówka tabeli,
    const HEADER_SECOND_TEXT = 'Status';             // po których skrypt znajduje wiersz nagłówka
    const ORDER_ID_FROM_ROW_ID = /^\d{6,}-[A-Z]$/;   // id wiersza <tr id="1070083620-A">
    const ORDER_ID_FROM_TEXT = /\d{6,}-[A-Z]/;       // awaryjnie z tekstu wiersza
    const CHECKED_BG = 'rgba(76, 175, 80, 0.12)';
    const STORAGE_KEY = 'mirakl_checked_orders';
    const DEBUG = true;                              // loguje do konsoli (F12)
    // ========================

    const host = location.hostname;
    const log = (...a) => DEBUG && console.log('[Checked?]', ...a);

    // ---------- pamięć ----------
    function loadAll() {
        try {
            return JSON.parse(GM_getValue(STORAGE_KEY, '{}')) || {};
        } catch (e) {
            return {};
        }
    }
    function isChecked(orderId) {
        const all = loadAll();
        return !!(all[host] && all[host][orderId]);
    }
    function setChecked(orderId, value) {
        const all = loadAll();
        if (!all[host]) all[host] = {};
        if (value) all[host][orderId] = Date.now();
        else delete all[host][orderId];
        GM_setValue(STORAGE_KEY, JSON.stringify(all));
    }

    // pomocnik: dokłada lewy padding raz (zapamiętuje oryginał w atrybucie)
    function addLeftPadding(el) {
        if (el.hasAttribute('data-kim-pad')) return;
        const orig = parseFloat(getComputedStyle(el).paddingLeft) || 0;
        el.setAttribute('data-kim-pad', String(orig));
        el.style.paddingLeft = orig + LEFT_SPACE + 'px';
    }

    // ---------- wiersze (ciało tabeli) ----------
    // link do zamówienia: /mmp/shop/order/<numer> (działa u każdego partnera Mirakl,
    // niezależnie od formatu numeru)
    const ORDER_LINK_RE = /\/mmp\/shop\/order\/([^/?#]+)\/?(?:[?#].*)?$/;

    function orderLinkOf(row) {
        for (const a of row.querySelectorAll('a[href]')) {
            const m = (a.getAttribute('href') || '').match(ORDER_LINK_RE);
            if (m) return { a, id: decodeURIComponent(m[1]) };
        }
        return null;
    }

    function getOrderId(row) {
        const l = orderLinkOf(row);
        if (l) return l.id;
        if (row.id && ORDER_ID_FROM_ROW_ID.test(row.id)) return row.id;
        const m = row.textContent.match(ORDER_ID_FROM_TEXT);
        return m ? m[0] : null;
    }

    function paintRow(row, checked) {
        row.style.backgroundColor = checked ? CHECKED_BG : '';
    }

    function findOrderCell(row) {
        const l = orderLinkOf(row);
        if (l) {
            const td = l.a.closest('td, [role="cell"], [role="gridcell"]');
            if (td && row.contains(td)) return { td, link: l.a };
        }
        const td = row.children[1] || row.children[0];
        return td ? { td, link: null } : null;
    }

    function addCheckbox(row) {
        if (row.querySelector('[data-kim-checked]')) return;

        const orderId = getOrderId(row);
        if (!orderId) return;

        const target = findOrderCell(row);
        if (!target) return;
        const { td, link } = target;

        // checkbox jest NA ZEWNĄTRZ linku, pozycjonowany bezwzględnie nad nim (z-index),
        // dzięki temu hover/kliknięcie linku go nie zasłania ani nie przejmuje
        td.style.position = 'relative';
        if (link) addLeftPadding(link);

        const wrap = document.createElement('span');
        wrap.setAttribute('data-kim-checked', '1');
        wrap.style.cssText =
            `position:absolute;left:${BOX_LEFT}px;width:${BOX_WIDTH}px;top:50%;transform:translateY(-50%);` +
            'z-index:10;line-height:0;display:flex;justify-content:center;';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.title = COLUMN_TITLE;
        cb.style.cssText = 'width:18px;height:18px;cursor:pointer;margin:0;';
        cb.checked = isChecked(orderId);
        paintRow(row, cb.checked);

        cb.addEventListener('change', () => {
            setChecked(orderId, cb.checked);
            paintRow(row, cb.checked);
        });
        ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((ev) =>
            wrap.addEventListener(ev, (e) => e.stopPropagation())
        );

        wrap.appendChild(cb);
        td.appendChild(wrap);
    }

    // ---------- nagłówek ----------
    const depth = (el) => {
        let d = 0;
        while ((el = el.parentElement)) d++;
        return d;
    };

    function leavesWithText(text) {
        return Array.from(document.querySelectorAll('span, div, th, a, button')).filter(
            (el) =>
                el.children.length === 0 &&
                el.textContent.trim() === text &&
                !el.closest('tbody') &&
                !el.closest('[data-kim-checked-th]')
        );
    }

    function lowestCommonAncestor(a, b) {
        const parents = new Set();
        for (let n = a.parentElement; n; n = n.parentElement) parents.add(n);
        for (let n = b.parentElement; n; n = n.parentElement) if (parents.has(n)) return n;
        return null;
    }

    // wiersz nagłówka = najniższy wspólny rodzic tytułów "Order ID" i "Status"
    function findHeaderRow() {
        const firsts = leavesWithText(HEADER_FIRST_TEXT);
        const seconds = leavesWithText(HEADER_SECOND_TEXT);
        let best = null;
        for (const a of firsts) {
            for (const b of seconds) {
                const lca = lowestCommonAncestor(a, b);
                if (!lca) continue;
                const d = depth(lca);
                if (!best || d > best.depth) best = { row: lca, depth: d, leaf: a };
            }
        }
        return best;
    }

    function cellOf(leaf, row) {
        let n = leaf;
        while (n.parentElement && n.parentElement !== row) n = n.parentElement;
        return n.parentElement === row ? n : null;
    }

    function addHeaderLabel() {
        if (document.querySelector('[data-kim-checked-th]')) return;

        const found = findHeaderRow();
        if (!found) {
            log('NIE znaleziono wiersza nagłówka (szukam "' + HEADER_FIRST_TEXT + '" i "' + HEADER_SECOND_TEXT + '")');
            return;
        }
        const { row, leaf } = found;
        const cell = cellOf(leaf, row);
        if (!cell) {
            log('Znaleziono wiersz nagłówka, ale nie komórkę "' + HEADER_FIRST_TEXT + '"', row);
            return;
        }

        // 1) przesuwamy tytuł "Order ID" w prawo (tak samo jak numery zamówień w wierszach)
        const titleBox = leaf.closest('[role="button"]') || leaf.parentElement;
        addLeftPadding(titleBox);

        // 2) dokładamy napis "Checked?" w tym miejscu po lewej, które właśnie zrobiliśmy
        cell.style.position = 'relative';
        const label = document.createElement('span');
        label.setAttribute('data-kim-checked-th', '1');
        label.className = leaf.className;            // ten sam krój/rozmiar co tytuły kolumn
        label.textContent = COLUMN_TITLE;
        label.style.cssText =
            `position:absolute;left:${BOX_LEFT}px;width:${BOX_WIDTH}px;top:50%;transform:translateY(-50%);` +
            'text-align:center;white-space:nowrap;pointer-events:none;z-index:10;';
        cell.appendChild(label);
        log('nagłówek "' + COLUMN_TITLE + '" dodany');
    }

    // ---------- główna pętla ----------
    function process() {
        const rows = Array.from(document.querySelectorAll('tbody tr, [role="row"]')).filter((r) => getOrderId(r));
        if (!rows.length) return;

        rows.forEach((row) => {
            try {
                addCheckbox(row);
            } catch (e) {
                log('błąd przy dodawaniu checkboxa', e);
            }
        });

        try {
            addHeaderLabel();
        } catch (e) {
            log('błąd przy dodawaniu nagłówka', e);
        }
    }

    // Mirakl to SPA – tabela jest przerysowywana, więc obserwujemy zmiany w DOM
    let timer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(process, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    log('skrypt uruchomiony na', location.href);
    process();

    setTimeout(() => {
        if (document.querySelector('[data-kim-checked]')) return;
        log(
            'po 3 s brak checkboxów. Wiersze tbody tr:', document.querySelectorAll('tbody tr').length,
            '| linki do /mmp/shop/order/:', document.querySelectorAll('a[href*="/mmp/shop/order/"]').length
        );
    }, 3000);
})();

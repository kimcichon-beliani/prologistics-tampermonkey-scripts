// ==UserScript==
// @name         Prologistics – ładniejszy Board (issue logs)
// @namespace    kimrioter
// @version      1.0.1
// @description  Czytelniejsze kafelki i kolumny w widoku Board na /react/logs/issue_logs/
// @author       kimrioter
// @match        https://www.prologistics.info/react/logs/issue_logs*
// @run-at       document-idle
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-issue-logs-board.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-issue-logs-board.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const BRAND = '#750000';

    // Kolory akcentu kolumn (pasek na górze kolumny)
    const COLUMN_COLORS = {
        'new': '#3b7ddd',
        'in progress': '#e0a100',
        'done': '#2f9e44',
        'prio': BRAND,
        '1:1': '#7e57c2',
        'automation': '#0b9ab8',
        'okr': '#c2255c',
        'new partner': '#1c9c7c',
    };

    // Mapowanie etykiety priorytetu (pierwszy chip na kafelku)
    const PRIORITY = {
        urgent: 'urgent', critical: 'urgent', blocker: 'urgent',
        high: 'high', medium: 'medium', low: 'low',
    };

    // ---------------------------------------------------------------
    // Style – wszystko opiera się na atrybutach data-tm-*, które dodaje JS,
    // bo klasy jssXXX generują się dynamicznie i mogą się zmieniać.
    // ---------------------------------------------------------------
    GM_addStyle(`
        /* ===== Kolumny ===== */
        [data-rbd-droppable-id="all-boards"] [class*="column-module__board"] {
            background: #f3f4f6 !important;
            border-radius: 12px !important;
            border-top: 4px solid var(--tm-col, #c4c8cf) !important;
            padding: 0 10px 6px !important;
            box-shadow: none !important;
        }
        [data-rbd-droppable-id="all-boards"] [class*="column-module__title"] {
            position: sticky;
            top: 0;
            z-index: 2;
            background: #f3f4f6;
            margin: 0 !important;
            padding: 12px 4px 10px !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            color: #2b2f36 !important;
            letter-spacing: 0 !important;
        }
        [data-rbd-droppable-id="all-boards"] [class*="column-module__tasksList"] {
            padding: 0 !important;
            min-height: 40px;
        }

        /* ===== Kafelek ===== */
        [data-tm-card] {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            column-gap: 8px !important;
            row-gap: 7px !important;
            background: #fff !important;
            border: 1px solid #e2e5ea !important;
            border-left: 5px solid var(--tm-prio, #c4c8cf) !important;
            border-radius: 8px !important;
            padding: 10px 12px 9px !important;
            margin: 0 0 8px !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            min-height: 0 !important;
            height: auto !important;
            transition: border-color .12s ease, box-shadow .12s ease;
        }
        [data-tm-card]:hover {
            border-color: #c9ced6 !important;
            border-left-color: var(--tm-prio, #c4c8cf) !important;
            box-shadow: 0 3px 10px rgba(30, 35, 45, .10) !important;
        }
        [data-tm-card]:focus-visible {
            outline: 2px solid ${BRAND} !important;
            outline-offset: 2px;
        }
        /* separator między treścią a stopką (pseudo-element jako element flexa) */
        [data-tm-card]::before {
            content: "";
            order: 5;
            flex-basis: 100%;
            height: 1px;
            background: #eef0f3;
            margin: 1px 0;
        }

        [data-tm-prio="urgent"] { --tm-prio: ${BRAND}; }
        [data-tm-prio="high"]   { --tm-prio: #e8590c; }
        [data-tm-prio="medium"] { --tm-prio: #f0b400; }
        [data-tm-prio="low"]    { --tm-prio: #6aa86f; }

        /* ===== Chipy (tagi) ===== */
        [data-tm-role="chips"] {
            order: 1;
            flex-basis: 100%;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 4px !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        [data-tm-role="chips"] .MuiChip-root {
            height: 20px !important;
            margin: 0 !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            max-width: 100%;
        }
        [data-tm-role="chips"] .MuiChip-label {
            padding: 0 7px !important;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        /* neutralne tagi (jasnoniebieskie w oryginale) – spokojniejsze */
        [data-tm-role="chips"] .MuiChip-root[style*="235, 245, 255"] {
            background: #f1f3f5 !important;
            color: #4a5059 !important;
            font-weight: 500 !important;
            box-shadow: inset 0 0 0 1px #e1e4e8;
        }

        /* ===== Tytuł ===== */
        [data-tm-role="title"] {
            order: 2;
            flex-basis: 100%;
            margin: 0 !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            line-height: 1.35 !important;
            color: #1f2329 !important;
            white-space: pre-line;
            overflow-wrap: anywhere;
        }

        /* ===== Checklista jako pasek postępu ===== */
        [data-tm-role="checklist"] {
            order: 3;
            flex-basis: 100%;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin: 0 !important;
            color: #5c636e !important;
        }
        [data-tm-role="checklist"] svg {
            width: 15px !important;
            height: 15px !important;
            margin: 0 !important;
        }
        [data-tm-role="checklist"] p {
            margin: 0 !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            min-width: 38px;
        }
        [data-tm-role="checklist"]::after {
            content: "";
            flex: 1;
            height: 5px;
            border-radius: 3px;
            background: linear-gradient(to right,
                var(--tm-bar, #3b7ddd) calc(var(--tm-p, 0) * 100%),
                #e7eaee calc(var(--tm-p, 0) * 100%));
        }
        [data-tm-role="checklist"][data-tm-done="1"] { --tm-bar: #2f9e44; }
        [data-tm-role="checklist"][data-tm-done="1"] svg { color: #2f9e44 !important; }

        /* ===== Deadline (np. OKR) ===== */
        [data-tm-role="deadline"] {
            order: 4;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            margin: 0 !important;
        }
        [data-tm-role="deadline"] svg { width: 15px !important; height: 15px !important; }
        [data-tm-role="deadline"] h6 { font-size: 12px !important; margin: 0 !important; }
        [data-tm-role="deadline"][data-tm-overdue="1"] h6,
        [data-tm-role="deadline"][data-tm-overdue="1"] svg { color: #c92a2a !important; }

        /* ===== Stopka: ID, czas, wiek, avatary ===== */
        [data-tm-role="id"] {
            order: 6;
            margin: 0 !important;
        }
        [data-tm-role="id"] p {
            margin: 0 !important;
            font-size: 11px !important;
            color: #8a919c !important;
        }
        [data-tm-role="id"] a {
            color: ${BRAND} !important;
            font-weight: 600;
            text-decoration: none !important;
        }
        [data-tm-role="id"] a:hover { text-decoration: underline !important; }

        [data-tm-role="time"] {
            order: 7;
            margin: 0 !important;
        }
        [data-tm-role="time"] [class*="time-spent-module__description"] {
            display: flex !important;
            align-items: center !important;
            gap: 2px !important;
            font-size: 11px !important;
            color: #6b727d !important;
        }
        [data-tm-role="time"] svg { width: 13px !important; height: 13px !important; }
        [data-tm-role="time"][data-tm-empty="1"] { display: none !important; }

        [data-tm-role="age"] {
            order: 8;
            width: auto !important;
            margin: 0 !important;
            text-align: left !important;
        }
        [data-tm-role="age"] h6 {
            display: inline-block;
            margin: 0 !important;
            padding: 1px 7px !important;
            border-radius: 10px;
            font-size: 11px !important;
            font-weight: 600 !important;
            line-height: 1.5 !important;
            background: #eef0f3;
            color: #555c66 !important;
        }
        [data-tm-role="age"][data-tm-age="warn"] h6 { background: #fff1db; color: #a35a00 !important; }
        [data-tm-role="age"][data-tm-age="old"] h6  { background: #fde8e8; color: #b42318 !important; }

        [data-tm-role="avatars"] {
            order: 9;
            margin: 0 0 0 auto !important;
            display: flex !important;
            flex-direction: row-reverse;
            justify-content: flex-end;
        }
        [data-tm-role="avatars"] .MuiAvatar-root {
            width: 24px !important;
            height: 24px !important;
            margin: 0 0 0 -6px !important;
            border: 2px solid #fff !important;
            box-sizing: content-box;
        }
        [data-tm-role="avatars"] .MuiAvatar-root:last-child { margin-left: 0 !important; }

        /* ===== Wymuszenie układu (nadpisuje style jss strony) ===== */
        [data-tm-card] {
            text-align: left !important;
            justify-content: flex-start !important;
            flex-direction: row !important;
            overflow: hidden !important;
        }
        /* reset: strona pozycjonuje część elementów absolutnie / flexem */
        [data-tm-card] > [data-tm-role] {
            position: static !important;
            float: none !important;
            top: auto !important;
            right: auto !important;
            left: auto !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            text-align: left !important;
        }
        /* elementy na całą szerokość – każdy w osobnym wierszu */
        [data-tm-card] > [data-tm-role="chips"],
        [data-tm-card] > [data-tm-role="title"],
        [data-tm-card] > [data-tm-role="checklist"],
        [data-tm-card]::before {
            flex: 0 0 100% !important;
            width: 100% !important;
            max-width: 100% !important;
        }
        [data-tm-card] > [data-tm-role="chips"] {
            justify-content: flex-start !important;
        }
        /* elementy stopki – w jednym wierszu, naturalna szerokość */
        [data-tm-card] > [data-tm-role="id"],
        [data-tm-card] > [data-tm-role="time"],
        [data-tm-card] > [data-tm-role="age"],
        [data-tm-card] > [data-tm-role="deadline"],
        [data-tm-card] > [data-tm-role="avatars"] {
            flex: 0 0 auto !important;
            width: auto !important;
            max-width: none !important;
        }
        [data-tm-card] > [data-tm-role="avatars"] {
            margin-left: auto !important;
        }

        @media (prefers-reduced-motion: reduce) {
            [data-tm-card] { transition: none; }
        }
    `);

    // ---------------------------------------------------------------
    // Pomocnicze
    // ---------------------------------------------------------------

    // Ustawia atrybut tylko gdy wartość się zmieniła (żeby nie mielić DOM-u)
    function setAttr(el, name, val) {
        if (el.getAttribute(name) !== val) el.setAttribute(name, val);
    }

    // Rozpoznaje rolę bezpośredniego dziecka kafelka po strukturze/treści
    function classifyChild(el) {
        if (el.matches('[class*="badge-list-module"]')) return 'avatars';
        if (el.matches('[class*="styles-module__container"]')) return 'time';
        if (el.classList.contains('MuiBox-root') && el.querySelector('.MuiChip-root')) return 'chips';
        if (el.tagName === 'P') return 'title';

        const txt = el.textContent.trim();
        if (/^ID:/.test(txt)) return 'id';
        if (/^\d+d\s+\d+h$/.test(txt)) return 'age';
        if (/^\d+\/\d+$/.test(txt)) return 'checklist';
        if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return 'deadline';
        return null;
    }

    // ---------------------------------------------------------------
    // Obróbka kafelka
    // ---------------------------------------------------------------
    function processCard(card) {
        setAttr(card, 'data-tm-card', '1');

        for (const child of card.children) {
            const role = classifyChild(child);
            if (!role) continue;
            setAttr(child, 'data-tm-role', role);
            const txt = child.textContent.trim();

            if (role === 'time') {
                // Pusta estymacja ("-") tylko zaśmieca kafelek
                setAttr(child, 'data-tm-empty', (txt === '-' || txt === '') ? '1' : '0');
            }

            if (role === 'checklist') {
                const [done, total] = txt.split('/').map(Number);
                const p = total ? Math.min(done / total, 1) : 0;
                if (child.style.getPropertyValue('--tm-p') !== p.toFixed(3)) {
                    child.style.setProperty('--tm-p', p.toFixed(3));
                }
                setAttr(child, 'data-tm-done', total && done >= total ? '1' : '0');
            }

            if (role === 'age') {
                // Czas w kolumnie: ≥30 dni pomarańczowy, ≥60 dni czerwony
                const days = parseInt(txt, 10) || 0;
                setAttr(child, 'data-tm-age', days >= 60 ? 'old' : days >= 30 ? 'warn' : 'ok');
            }

            if (role === 'deadline') {
                const deadline = new Date(txt + 'T23:59:59');
                setAttr(child, 'data-tm-overdue', deadline < new Date() ? '1' : '0');
            }
        }

        // Priorytet = pierwszy chip
        const firstLabel = card.querySelector('.MuiChip-label');
        const prioKey = (firstLabel ? firstLabel.textContent : '').trim().toLowerCase();
        setAttr(card, 'data-tm-prio', PRIORITY[prioKey] || 'none');
    }

    // ---------------------------------------------------------------
    // Obróbka kolumny (kolor akcentu po nazwie)
    // ---------------------------------------------------------------
    function processColumn(board) {
        const title = board.querySelector('[class*="column-module__title"]');
        if (!title) return;
        const name = title.textContent
            .replace(/\(\d+\)\s*$/, '')
            .replace(/\.\s*$/, '')
            .trim()
            .toLowerCase();
        const color = COLUMN_COLORS[name] || '#c4c8cf';
        if (board.style.getPropertyValue('--tm-col') !== color) {
            board.style.setProperty('--tm-col', color);
        }
    }

    function run() {
        const root = document.querySelector('[data-rbd-droppable-id="all-boards"]');
        if (!root) return; // widok List albo jeszcze się nie załadowało

        root.querySelectorAll('[class*="column-module__board"]').forEach(processColumn);
        root.querySelectorAll('[class*="column-module__tasksList"] > [data-rbd-draggable-id]')
            .forEach(processCard);
    }

    // ---------------------------------------------------------------
    // SPA – React przerysowuje board (filtry, przełączanie List/Board,
    // drag & drop), więc obserwujemy zmiany i odpalamy run() raz na klatkę.
    // ---------------------------------------------------------------
    let scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            try {
                run();
            } catch (e) {
                console.error(LOG, 'Błąd podczas stylowania boardu:', e);
            }
        });
    }

    new MutationObserver(schedule).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    schedule();
    console.log(LOG, 'Board issue_logs – style załadowane');
})();

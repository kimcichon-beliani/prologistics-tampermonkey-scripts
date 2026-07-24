// ==UserScript==
// @name         Zwijany sidebar — Prologistics
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Pozwala schować/rozwinąć boczne menu, zostawiając widoczny czas pracy i przycisk wylogowania
// @author       kimrioter
// @match        https://www.prologistics.info/*
// @exclude      https://www.prologistics.info/react/*
// @run-at       document-idle
// @grant        none
// @updateURL https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/sidebar-collapse.user.js
// @downloadURL https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/sidebar-collapse.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM sidebar script by kimrioter] Start');

    const STORAGE_KEY = 'tm_sidebar_collapsed';
    let initialized = false;

    function setup() {
        if (initialized) return;

        const sidebar = document.querySelector('td.leftSideMenu');
        if (!sidebar) return;

        initialized = true;
        console.log('[TM sidebar script by kimrioter] Znaleziono sidebar, inicjalizuję');

        // Wstrzykujemy style
        const style = document.createElement('style');
        style.textContent = `
            td.leftSideMenu {
                position: relative;
                transition: width 0.15s ease;
            }
            td.leftSideMenu.tm-collapsed {
                width: 76px !important;
                min-width: 76px !important;
                max-width: 76px !important;
                overflow: visible;
            }
            .tm-toggle-container {
                margin-bottom: 8px;
            }
            .tm-toggle-btn {
                cursor: pointer;
                border: 1px solid #ccc;
                background: #f4f4f4;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 14px;
                line-height: 1;
                user-select: none;
                display: inline-block;
            }
            .tm-toggle-btn:hover {
                background: #e6e6e6;
            }
            .tm-sidebar-persistent {
                display: block;
                width: max-content;
                max-width: 76px;
            }
            td.leftSideMenu.tm-collapsed .tm-collapsible-content {
                display: none;
            }

            /* Panel z Logout + czas pracy — przyklejony do lewej krawędzi, wyśrodkowany pionowo, przewija się z użytkownikiem */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent {
                position: fixed;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                z-index: 9999;
                background: #ffffff;
                padding: 14px 8px;
                box-shadow: 2px 2px 10px rgba(0,0,0,0.12);
                border: 1px solid #e2e2e2;
                border-left: none;
                border-radius: 0 8px 8px 0;
            }

            /* Resetujemy wszelkie tła/obramowania/czcionki odziedziczone z oryginalnych stylów strony —
               na WSZYSTKICH zagnieżdżonych elementach (nie tylko bezpośrednich dzieciach), żeby wygląd
               był identyczny na każdej podstronie, niezależnie od jej własnych reguł CSS.
               Kolor NIE jest tu resetowany, żeby zachować oryginalne kolory (zielony "IN", czerwony "LOG OUT"). */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent * {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                box-sizing: border-box !important;
                font-family: Arial, sans-serif !important;
                font-size: 12px !important;
                letter-spacing: 0.5px !important;
                line-height: 1.4 !important;
            }

            /* Tekst pionowy czytany od dołu do góry — display:block zamiast flex-item,
               dzięki czemu przeglądarka poprawnie liczy wysokość/szerokość tekstu pionowego.
               !important wszędzie, żeby przebić style specyficzne dla danej podstrony */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent > * {
                display: block !important;
                writing-mode: vertical-rl !important;
                transform: rotate(180deg) !important;
                text-orientation: mixed !important;
                white-space: nowrap !important;
                margin: 0 0 14px 0 !important;
                overflow: visible !important;
                font-size: 12px !important;
                font-family: Arial, sans-serif !important;
                font-weight: normal !important;
                letter-spacing: 0.5px !important;
                line-height: 1.4 !important;
                color: #333 !important;
            }
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent > *:last-child {
                margin-bottom: 0 !important;
            }

            /* Delikatny separator między sekcją Logout a czasem pracy */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent a[href="/logout.php"] {
                padding-bottom: 10px;
                border-bottom: 1px solid #e2e2e2 !important;
                height: var(--tm-logout-height, auto);
            }

            /* Logout — lekko pogrubiony (nie pełny bold), bez dodatkowego stylu.
               Celujemy też w zagnieżdżony <b>, bo on ma własny, mocniejszy bold z przeglądarki */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent a[href="/logout.php"],
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent a[href="/logout.php"] b {
                font-weight: 600 !important;
                text-decoration: none !important;
                color: #333 !important;
            }

            /* Przycisk LOG OUT — nowoczesna "pigułka" zamiast natywnego przycisku systemowego */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent input#timesheet_button {
                background: #fdecea !important;
                color: #d32f2f !important;
                cursor: pointer;
                font-weight: bold;
                padding: 6px 4px !important;
                border-radius: 10px !important;
                transition: background 0.15s ease;
            }
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent input#timesheet_button:hover {
                background: #fbd5d1 !important;
            }
            td.leftSideMenu:not(.tm-collapsed) .tm-collapsed-only {
                display: none;
            }
        `;
        document.head.appendChild(style);

        // Kontener na przycisk toggle — zostaje w normalnym miejscu na górze strony (nie przewija się jako fixed)
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'tm-toggle-container';

        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'tm-toggle-btn';
        toggleBtn.textContent = '☰';
        toggleBtn.title = 'Zwiń / rozwiń menu';
        toggleContainer.appendChild(toggleBtn);

        // Kontener na elementy przyklejone na stałe (Logout + czas pracy) — position: fixed w stanie zwiniętym
        const persistentPanel = document.createElement('div');
        persistentPanel.className = 'tm-sidebar-persistent';

        // Mierzy rzeczywistą długość tekstu (w normalnym, poziomym renderowaniu),
        // żeby jawnie ustawić wysokość elementu obróconego o 180° — inaczej przeglądarka
        // czasem źle liczy miejsce potrzebne na pionowy tekst i tło nie obejmuje go w całości
        function measureTextWidth(text, bold) {
            const span = document.createElement('span');
            span.style.position = 'absolute';
            span.style.visibility = 'hidden';
            span.style.whiteSpace = 'nowrap';
            span.style.fontSize = '12px';
            span.style.fontFamily = 'Arial, sans-serif';
            span.style.letterSpacing = '0.5px';
            if (bold) span.style.fontWeight = 'bold';
            span.textContent = text;
            document.body.appendChild(span);
            const width = span.offsetWidth;
            span.remove();
            return width;
        }

        // Znajdujemy oryginalny link "Logout" (razem z jego <b>) i przenosimy (nie klonujemy!)
        const logoutLink = sidebar.querySelector('a[href="/logout.php"]');
        if (logoutLink) {
            persistentPanel.appendChild(logoutLink);
            const textWidth = measureTextWidth(logoutLink.textContent.trim(), true);
            // Ustawiamy jako zmienną CSS — właściwa wysokość zadziała TYLKO w stanie zwiniętym
            // (patrz reguła .tm-collapsed w arkuszu stylów), a w rozwiniętym widoku link zachowa naturalną wysokość
            logoutLink.style.setProperty('--tm-logout-height', (textWidth + 8) + 'px');
        }

        // Znajdujemy oryginalny div.timesheet_wrapper (z czasem pracy i przyciskiem LOG OUT) i przenosimy
        const timesheetWrapper = sidebar.querySelector('.timesheet_wrapper');
        if (timesheetWrapper) {
            persistentPanel.appendChild(timesheetWrapper);
        }

        // Wszystko, co zostało w sidebarze (reszta linków), przenosimy do zwijalnego kontenera
        const collapsibleContent = document.createElement('div');
        collapsibleContent.className = 'tm-collapsible-content';

        // Przenosimy WSZYSTKIE pozostałe dzieci sidebara (w tym tekst, <br>, <a> itd.)
        while (sidebar.firstChild) {
            collapsibleContent.appendChild(sidebar.firstChild);
        }

        // Składamy sidebar na nowo: toggle (statyczny) → panel przyklejony (fixed) → zwijalna reszta
        sidebar.appendChild(toggleContainer);
        sidebar.appendChild(persistentPanel);
        sidebar.appendChild(collapsibleContent);

        // Wczytujemy zapamiętany stan
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState === 'true') {
            sidebar.classList.add('tm-collapsed');
        }

        toggleBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.toggle('tm-collapsed');
            localStorage.setItem(STORAGE_KEY, isCollapsed ? 'true' : 'false');
            console.log('[TM sidebar script by kimrioter] Sidebar', isCollapsed ? 'zwinięty' : 'rozwinięty');
        });

        console.log('[TM sidebar script by kimrioter] Sidebar zainicjalizowany');
    }

    setup();

    const observer = new MutationObserver(() => {
        if (!initialized) setup();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM sidebar script by kimrioter] Zainicjalizowano observer');
})();

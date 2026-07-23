// ==UserScript==
// @name         Zwijany sidebar — Prologistics
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Pozwala schować/rozwinąć boczne menu, zostawiając widoczny czas pracy i przycisk wylogowania
// @author       kimrioter
// @match        https://www.prologistics.info/*
// @run-at       document-idle
// @grant        none
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
                width: 28px !important;
                min-width: 28px !important;
                max-width: 28px !important;
                overflow: visible;
            }
            .tm-sidebar-persistent {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 6px;
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
                flex-shrink: 0;
            }
            .tm-toggle-btn:hover {
                background: #e6e6e6;
            }
            td.leftSideMenu.tm-collapsed .tm-collapsible-content {
                display: none;
            }

            /* W stanie zwiniętym: tekst pionowy, przyklejony do lewej krawędzi */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent > *:not(.tm-toggle-btn) {
                writing-mode: vertical-rl;
                text-orientation: mixed;
                white-space: nowrap;
                margin: 0;
                max-height: 300px;
            }
            td.leftSideMenu:not(.tm-collapsed) .tm-collapsed-only {
                display: none;
            }
        `;
        document.head.appendChild(style);

        // Kontener na elementy zawsze widoczne (przycisk toggle + logout + timesheet)
        const persistentPanel = document.createElement('div');
        persistentPanel.className = 'tm-sidebar-persistent';

        // Przycisk zwijania/rozwijania
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'tm-toggle-btn';
        toggleBtn.textContent = '☰';
        toggleBtn.title = 'Zwiń / rozwiń menu';
        persistentPanel.appendChild(toggleBtn);

        // Znajdujemy oryginalny link "Logout" (razem z jego <b>) i przenosimy (nie klonujemy!)
        const logoutLink = sidebar.querySelector('a[href="/logout.php"]');
        if (logoutLink) {
            persistentPanel.appendChild(logoutLink);
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

        // Składamy sidebar na nowo: najpierw panel zawsze widoczny, potem zwijalna reszta
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

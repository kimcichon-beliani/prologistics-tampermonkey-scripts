// ==UserScript==
// @name         Zwijany sidebar — Prologistics
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Pozwala schować/rozwinąć boczne menu ze stabilnym układem, bordo przyciskiem i pogrubionym "IN".
// @author       kimrioter
// @match        https://www.prologistics.info/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/sidebar-collapse.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/sidebar-collapse.user.js
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

            /* GWARANCJA ZWIJANIA TREŚCI MENU */
            td.leftSideMenu.tm-collapsed .tm-collapsible-content {
                display: none !important;
            }

            /* Panel z Logout + czas pracy */
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

            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent a[href="/logout.php"] {
                padding-bottom: 10px;
                border-bottom: 1px solid #e2e2e2 !important;
                height: var(--tm-logout-height, auto);
            }

            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent a[href="/logout.php"],
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent a[href="/logout.php"] b {
                font-weight: 600 !important;
                text-decoration: none !important;
                color: #1e293b !important;
            }

            /* Dedykowane pogrubienie wyłącznie dla napisów IN / OUT */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent .timesheet_wrapper font[color="green"],
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent .timesheet_wrapper b {
                font-weight: 800 !important;
            }

            /* Przycisk LOG OUT — w kolorze bordo (ProLogistics Red) */
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent input#timesheet_button {
                background: #800000 !important;
                color: #ffffff !important;
                cursor: pointer;
                font-weight: bold;
                padding: 6px 4px !important;
                border-radius: 6px !important;
                transition: background 0.15s ease;
            }
            td.leftSideMenu.tm-collapsed .tm-sidebar-persistent input#timesheet_button:hover {
                background: #660000 !important;
            }
            td.leftSideMenu:not(.tm-collapsed) .tm-collapsed-only {
                display: none;
            }
        `;
        document.head.appendChild(style);

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'tm-toggle-container';

        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'tm-toggle-btn';
        toggleBtn.textContent = '☰';
        toggleBtn.title = 'Zwiń / rozwiń menu';
        toggleContainer.appendChild(toggleBtn);

        const persistentPanel = document.createElement('div');
        persistentPanel.className = 'tm-sidebar-persistent';

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

        const logoutLink = sidebar.querySelector('a[href="/logout.php"]');
        const logoutPlaceholder = document.createComment('tm-logout-placeholder');
        if (logoutLink) {
            logoutLink.parentNode.insertBefore(logoutPlaceholder, logoutLink);
            const textWidth = measureTextWidth(logoutLink.textContent.trim(), true);
            logoutLink.style.setProperty('--tm-logout-height', (textWidth + 8) + 'px');
        }

        const timesheetWrapper = sidebar.querySelector('.timesheet_wrapper');
        const timesheetPlaceholder = document.createComment('tm-timesheet-placeholder');
        if (timesheetWrapper) {
            timesheetWrapper.parentNode.insertBefore(timesheetPlaceholder, timesheetWrapper);

            // Formatujemy natywne IN/OUT bezpośrednio w drzewie DOM, żeby tylko ono otrzymało font-weight: 800
            const fontNode = timesheetWrapper.querySelector('font');
            if (fontNode) {
                fontNode.style.setProperty('font-weight', '800', 'important');
            }
        }

        const collapsibleContent = document.createElement('div');
        collapsibleContent.className = 'tm-collapsible-content';

        while (sidebar.firstChild) {
            collapsibleContent.appendChild(sidebar.firstChild);
        }

        sidebar.appendChild(toggleContainer);
        sidebar.appendChild(persistentPanel);
        sidebar.appendChild(collapsibleContent);

        function applyElementPositions(collapsed) {
            if (collapsed) {
                if (logoutLink) persistentPanel.appendChild(logoutLink);
                if (timesheetWrapper) persistentPanel.appendChild(timesheetWrapper);
            } else {
                if (logoutLink && logoutPlaceholder.parentNode) {
                    logoutPlaceholder.parentNode.insertBefore(logoutLink, logoutPlaceholder.nextSibling);
                }
                if (timesheetWrapper && timesheetPlaceholder.parentNode) {
                    timesheetPlaceholder.parentNode.insertBefore(timesheetWrapper, timesheetPlaceholder.nextSibling);
                }
            }
        }

        const savedState = localStorage.getItem(STORAGE_KEY);
        const isCollapsedInitially = savedState === 'true';
        if (isCollapsedInitially) {
            sidebar.classList.add('tm-collapsed');
        }
        applyElementPositions(isCollapsedInitially);

        toggleBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.toggle('tm-collapsed');
            applyElementPositions(isCollapsed);
            localStorage.setItem(STORAGE_KEY, isCollapsed ? 'true' : 'false');
        });
    }

    setup();

    const observer = new MutationObserver(() => {
        if (!initialized) setup();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();

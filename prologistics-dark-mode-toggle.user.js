// ==UserScript==
// @name         Tryb ciemny — Prologistics
// @namespace    https://www.prologistics.info/
// @version      1.1
// @description  Dodaje przełącznik trybu ciemnego/jasnego w prawym górnym rogu strony
// @author       kimrioter
// @match        https://www.prologistics.info/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-dark-mode-toggle.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-dark-mode-toggle.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'tm_dark_mode_enabled';

    function applyState(isDark) {
        document.documentElement.classList.toggle('tm-dark-mode', isDark);
    }

    // Stosujemy zapamiętany stan JAK NAJWCZEŚNIEJ (document-start), zanim strona się narysuje —
    // dzięki temu unikamy "mignięcia" jasnym tłem przy każdym przeładowaniu strony
    const savedState = localStorage.getItem(STORAGE_KEY) === 'true';
    applyState(savedState);

    // Odwracamy kolory całej strony filtrem CSS — uniwersalne rozwiązanie działające
    // od razu na każdej podstronie, bez ręcznego dostosowywania każdego elementu z osobna.
    // Obrazki/wideo dostają odwrócenie JESZCZE RAZ, żeby "wrócić" do normalnych kolorów
    // (podwójne odwrócenie = powrót do oryginału), zamiast wyglądać jak negatyw zdjęcia.
    // Suwak jest odwracany razem ze stroną, więc też dostaje odwrócenie JESZCZE RAZ,
    // dzięki czemu jego kolory (jasny tor / ciemny tor) zawsze wyglądają tak, jak je zdefiniowaliśmy.
    const style = document.createElement('style');
    style.textContent = `
        html.tm-dark-mode {
            filter: invert(1) hue-rotate(180deg) !important;
            background: #ffffff !important;
        }
        html.tm-dark-mode img,
        html.tm-dark-mode video,
        html.tm-dark-mode iframe,
        html.tm-dark-mode canvas {
            filter: invert(1) hue-rotate(180deg) !important;
        }

        #tm-dark-mode-toggle {
            position: fixed;
            top: 14px;
            right: 14px;
            z-index: 999999;
            width: 56px;
            height: 28px;
            border-radius: 999px;
            background: #e4e6eb;
            border: 1px solid rgba(0,0,0,0.06);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.04);
            cursor: pointer;
            user-select: none;
            transition: background-color 0.35s ease;
        }
        #tm-dark-mode-toggle.tm-on {
            background: #1c1f26;
        }
        #tm-dark-mode-toggle .tm-toggle-thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #ffffff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.35s cubic-bezier(.4,0,.2,1);
        }
        #tm-dark-mode-toggle.tm-on .tm-toggle-thumb {
            transform: translateX(28px);
        }
        #tm-dark-mode-toggle svg {
            width: 14px;
            height: 14px;
            display: block;
        }
        /* W trybie ciemnym całej strony odwracamy suwak PONOWNIE, żeby jego kolory
           (tor i kulka) zawsze wyglądały tak, jak je zaprojektowaliśmy, a nie jak negatyw */
        html.tm-dark-mode #tm-dark-mode-toggle {
            filter: invert(1) hue-rotate(180deg) !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);

    // Proste, eleganckie ikony SVG (bez emoji) — słońce dla trybu jasnego, księżyc dla ciemnego
    const SUN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#e0a324" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"></path>
    </svg>`;
    const MOON_ICON = `<svg viewBox="0 0 24 24" fill="#4a5568" stroke="none">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"></path>
    </svg>`;

    function createToggleButton() {
        if (document.getElementById('tm-dark-mode-toggle')) return;

        const btn = document.createElement('div');
        btn.id = 'tm-dark-mode-toggle';
        btn.title = 'Przełącz tryb ciemny / jasny';
        btn.setAttribute('role', 'switch');

        const thumb = document.createElement('div');
        thumb.className = 'tm-toggle-thumb';
        btn.appendChild(thumb);

        function updateState() {
            const isDark = document.documentElement.classList.contains('tm-dark-mode');
            btn.classList.toggle('tm-on', isDark);
            btn.setAttribute('aria-checked', String(isDark));
            thumb.innerHTML = isDark ? MOON_ICON : SUN_ICON;
        }
        updateState();

        btn.addEventListener('click', () => {
            const isDark = !document.documentElement.classList.contains('tm-dark-mode');
            applyState(isDark);
            localStorage.setItem(STORAGE_KEY, isDark ? 'true' : 'false');
            updateState();
        });

        document.body.appendChild(btn);
    }

    if (document.body) {
        createToggleButton();
    } else {
        document.addEventListener('DOMContentLoaded', createToggleButton);
    }
})();

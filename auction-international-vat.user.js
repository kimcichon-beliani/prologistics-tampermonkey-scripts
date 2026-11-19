// ==UserScript==
// @name         Prologistics – International VAT (Change order) pod Customer Details
// @namespace    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @version      1.0.0
// @description  Na auction.php pod tabelą "Customer Details" wstawia sekcję International VAT z "Change order": kraj + numer VAT, Verify VAT, "Goods should be sent without VAT" i "Make 0% VAT Invoice".
// @author       kimrioter
// @match        https://www.prologistics.info/auction.php*
// @noframes
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auction-international-vat.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auction-international-vat.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const IFRAME_NAME = 'tmkr-vat-frame';
    const MAX_FULL_HEIGHT = 800; // maks. wysokość okienka w trybie "cała strona"

    // Czy ładować Change order automatycznie przy wejściu na zamówienie?
    // false = dopiero po kliknięciu "Załaduj" (bezpieczniej i szybciej).
    const AUTO_LOAD = false;

    // Elementy z formularza Change order, które zostają widoczne
    const KEEP_IDS = [
        'vat_country',          // select z krajem
        'customer_vat',         // numer VAT
        'verify_vat',           // Verify VAT
        'vat_valid_result',     // wynik weryfikacji
        'customer_vat_apply',   // Goods should be sent without VAT
        'customer_vat_clear',   // Undo send WITH VAT
        'customer_vat_make_0',  // Make 0% VAT Invoice
        'customer_vat_undo_0',  // Undo 0% VAT Invoice
        'submit-button'         // Dalej – zatwierdza zmianę
    ];

    // Wyjście, jeśli strona nie ma tabeli Customer Details
    const cdCell = document.getElementById('customer_details');
    const cdTable = cdCell && cdCell.closest('table');
    if (!cdTable) {
        console.log(LOG, 'Brak tabeli Customer Details – skrypt nic nie robi.');
        return;
    }
    if (document.getElementById('tmkr-vat-panel')) return; // już wstawione

    // ---------- Panel ----------
    const panel = document.createElement('div');
    panel.id = 'tmkr-vat-panel';
    panel.innerHTML = `
        <style>
            #tmkr-vat-panel { border: 2px solid ${BRAND}; border-radius: 4px; margin: 8px 0; font: 12px Arial, sans-serif; background: #fff; }
            #tmkr-vat-panel .tmkr-head { background: ${BRAND}; color: #fff; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
            #tmkr-vat-panel .tmkr-head button { background: #fff; color: ${BRAND}; border: 0; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 11px; font-weight: bold; }
            #tmkr-vat-panel .tmkr-head button[disabled] { opacity: .5; cursor: default; }
            #tmkr-vat-panel .tmkr-status { padding: 4px 8px; color: #555; }
            #tmkr-vat-panel .tmkr-status.err { color: #b00020; font-weight: bold; }
            #tmkr-vat-panel iframe { display: block; width: 100%; height: 0; border: 0; }
        </style>
        <div class="tmkr-head">
            <b>International VAT (Change order)</b>
            <span>
                <button type="button" class="tmkr-load">Załaduj</button>
                <button type="button" class="tmkr-full" disabled>Pokaż całą stronę</button>
            </span>
        </div>
        <div class="tmkr-status">Kliknij „Załaduj”, żeby pobrać sekcję VAT z Change order.</div>
        <iframe name="${IFRAME_NAME}" title="Change order – International VAT"></iframe>
    `;
    cdTable.insertAdjacentElement('afterend', panel);

    const btnLoad = panel.querySelector('.tmkr-load');
    const btnFull = panel.querySelector('.tmkr-full');
    const statusEl = panel.querySelector('.tmkr-status');
    const iframe = panel.querySelector('iframe');

    let loadCount = 0;
    let fullView = false;
    let resizeObs = null;

    function setStatus(text, isError) {
        statusEl.textContent = text;
        statusEl.classList.toggle('err', !!isError);
    }

    // ---------- Szukanie "Change order" na auction.php ----------
    function findChangeOrderTrigger() {
        const re = /change\s*order|zmie[nń]\s*zam[oó]wienie/i;
        const cands = document.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
        for (const el of cands) {
            if (panel.contains(el)) continue;
            const label = (el.tagName === 'INPUT' ? el.value : el.textContent || '').trim();
            if (re.test(label)) return el;
        }
        return null;
    }

    // Otwiera Change order w iframe – link, onclick z adresem albo formularz
    function openChangeOrderInFrame(trigger) {
        const href = trigger.getAttribute('href');
        if (trigger.tagName === 'A' && href && !/^\s*(#|javascript:)/i.test(href)) {
            iframe.src = trigger.href;
            return true;
        }

        const onclick = trigger.getAttribute('onclick') || '';
        const m = onclick.match(/['"]([^'"]*\.php[^'"]*)['"]/);
        if (m) {
            iframe.src = new URL(m[1], location.href).href;
            return true;
        }

        const form = trigger.form || trigger.closest('form');
        if (form) {
            const prevTarget = form.getAttribute('target');
            let extra = null;
            if (trigger.name) {
                extra = document.createElement('input');
                extra.type = 'hidden';
                extra.name = trigger.name;
                extra.value = trigger.value || '';
                form.appendChild(extra);
            }
            form.target = IFRAME_NAME;
            HTMLFormElement.prototype.submit.call(form);
            setTimeout(() => {
                if (prevTarget === null) form.removeAttribute('target');
                else form.setAttribute('target', prevTarget);
                if (extra) extra.remove();
            }, 0);
            return true;
        }
        return false;
    }

    // ---------- Wycinanie sekcji VAT w iframe ----------
    function injectStyle(doc) {
        if (doc.getElementById('tmkr-iso-style')) return;
        const st = doc.createElement('style');
        st.id = 'tmkr-iso-style';
        st.textContent = `
            html:not(.tmkr-full) .tmkr-hide { display: none !important; }
            html:not(.tmkr-full), html:not(.tmkr-full) body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; background: #fff !important; }
            html:not(.tmkr-full) body { padding: 6px 8px !important; font: 12px Arial, sans-serif; }
            html:not(.tmkr-full) #customer_vat_apply,
            html:not(.tmkr-full) #customer_vat_clear,
            html:not(.tmkr-full) #customer_vat_make_0,
            html:not(.tmkr-full) #customer_vat_undo_0 { margin: 3px 3px 3px 0; }
            html:not(.tmkr-full) #submit-button { font-weight: bold; color: ${BRAND}; }
        `;
        doc.head.appendChild(st);
    }

    function isolateVatSection(doc) {
        const keep = KEEP_IDS.map(id => doc.getElementById(id)).filter(Boolean);
        const keepSet = new Set(keep);

        // zostawiamy <br> zaraz po zachowanych elementach (układ przycisków jak w oryginale)
        keep.forEach(el => {
            const next = el.nextElementSibling;
            if (next && next.tagName === 'BR') keepSet.add(next);
        });

        // przodkowie zachowanych elementów
        const onPath = new Set();
        keep.forEach(el => {
            let n = el.parentElement;
            while (n && n !== doc.documentElement) { onPath.add(n); n = n.parentElement; }
        });

        // chowamy wszystko poza ścieżką (też luźne teksty, np. "Kiedy mamy wysłać...")
        onPath.forEach(anc => {
            Array.from(anc.childNodes).forEach(child => {
                if (child.nodeType === 1) {
                    if (!onPath.has(child) && !keepSet.has(child) && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
                        child.classList.add('tmkr-hide');
                    }
                } else if (child.nodeType === 3 && child.textContent.trim()) {
                    const wrap = doc.createElement('span');
                    wrap.className = 'tmkr-hide';
                    child.replaceWith(wrap);
                    wrap.appendChild(child);
                }
            });
        });

        return keep.length;
    }

    // Uzupełnia kraj / numer VAT danymi z Customer Details, jeśli w Change order są puste
    function prefillFromAuction(doc) {
        const pairs = [
            [document.getElementById('customer_vat_country'), doc.getElementById('vat_country')],
            [document.getElementById('customer_vat'), doc.getElementById('customer_vat')]
        ];
        pairs.forEach(([src, dst]) => {
            if (src && dst && src.value && !dst.value) {
                dst.value = src.value;
                dst.dispatchEvent(new Event('input', { bubbles: true }));
                dst.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // ---------- Dopasowanie wysokości iframe ----------
    function fitHeight() {
        let doc;
        try { doc = iframe.contentDocument; } catch (e) { return; }
        if (!doc || !doc.body) return;
        const h = Math.ceil(doc.body.scrollHeight) + 4;
        iframe.style.height = (fullView ? Math.min(h, MAX_FULL_HEIGHT) : h) + 'px';
    }

    function watchHeight(doc) {
        if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
        const RO = iframe.contentWindow && iframe.contentWindow.ResizeObserver;
        if (RO) {
            resizeObs = new RO(fitHeight);
            resizeObs.observe(doc.body);
        }
        fitHeight();
    }

    function setFullView(on) {
        fullView = on;
        btnFull.textContent = on ? 'Pokaż tylko VAT' : 'Pokaż całą stronę';
        try {
            const doc = iframe.contentDocument;
            if (doc) doc.documentElement.classList.toggle('tmkr-full', on);
        } catch (e) { /* ignorujemy */ }
        fitHeight();
    }

    // ---------- Obsługa kolejnych załadowań iframe ----------
    iframe.addEventListener('load', () => {
        let doc = null;
        try { doc = iframe.contentDocument; } catch (e) { doc = null; }

        if (doc && doc.location.href === 'about:blank') return; // pusty start iframe

        if (!doc || !doc.body) {
            setStatus('Nie udało się osadzić Change order (strona blokuje ramki?). Otwórz Change order normalnie.', true);
            console.warn(LOG, 'Brak dostępu do dokumentu w iframe.');
            return;
        }

        loadCount++;
        injectStyle(doc);
        btnFull.disabled = false;

        const hasVat = !!doc.getElementById('customer_vat_apply');
        const backOnAuction = /\/auction\.php$/i.test(doc.location.pathname) && !!doc.getElementById('customer_details');

        if (hasVat) {
            const kept = isolateVatSection(doc);
            prefillFromAuction(doc);
            setFullView(false);
            setStatus('Wybierz kraj, wpisz numer VAT → Verify VAT → przycisk VAT → „Dalej”, żeby zapisać. „Pokaż całą stronę” pokaże ceny i resztę formularza.');
            console.log(LOG, 'Sekcja VAT załadowana, zachowane elementy:', kept);
        } else if (loadCount > 1 && backOnAuction) {
            setStatus('Zmiana zapisana – odświeżam zamówienie…');
            console.log(LOG, 'Change order zakończony, przeładowanie strony.');
            setTimeout(() => location.reload(), 800);
            return;
        } else {
            setFullView(true);
            if (loadCount === 1) {
                setStatus('Nie znaleziono sekcji International VAT na stronie Change order – pokazuję całą stronę.', true);
            } else {
                setStatus('Kolejny krok Change order – dokończ go w okienku poniżej.');
            }
        }

        watchHeight(doc);
    });

    // ---------- Przyciski ----------
    function load() {
        const trigger = findChangeOrderTrigger();
        if (!trigger) {
            setStatus('Nie znalazłam przycisku/linku „Change order” na tej stronie.', true);
            console.warn(LOG, 'Brak elementu Change order.');
            return;
        }
        loadCount = 0;
        setStatus('Ładuję Change order…');
        if (!openChangeOrderInFrame(trigger)) {
            setStatus('Nie umiem otworzyć „Change order” z tego przycisku (brak adresu i formularza).', true);
            console.warn(LOG, 'Nieobsługiwany trigger Change order:', trigger);
            return;
        }
        btnLoad.textContent = 'Załaduj ponownie';
    }

    btnLoad.addEventListener('click', load);
    btnFull.addEventListener('click', () => setFullView(!fullView));

    if (AUTO_LOAD) load();
    console.log(LOG, 'International VAT (Change order) – panel dodany.');
})();

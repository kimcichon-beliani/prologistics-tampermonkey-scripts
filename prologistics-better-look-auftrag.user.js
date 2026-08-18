// ==UserScript==
// @name         Prologistics – A Better Look – Auftrag
// @namespace    https://github.com/kimcichon-beliani
// @version      2.0.0
// @description  Porządkuje układ auction.php: Articles nad Calculation Tables, Resume emails pod Auftrag # oraz odświeżony wygląd przycisków
// @author       kimrioter
// @match        *://*.prologistics.info/auction.php*
// @match        *://prologistics.info/auction.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-better-look-auftrag.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-better-look-auftrag.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';

    /* ============================ KONFIGURACJA ============================
       Sekcja Articles leży POZA form1, a Calculation Tables wewnątrz form1.
       Dlatego przed przeniesieniem każde pole z przenoszonego bloku dostaje
       atrybut form="id-oryginalnego-formularza" – dzięki temu po zmianie
       miejsca w DOM nadal wysyła się tam, gdzie wcześniej.
       ====================================================================== */
    const CFG = {
        sourceStartId: 'tracking_numbers', // początek przenoszonej sekcji
        sourceEndId:   'printer_log',      // pierwsza sekcja, która ZOSTAJE na miejscu
        targetId:      'calculations',     // wstawiamy nad tą sekcją
        pinForms:      true,               // zabezpieczenie formularzy (nie wyłączaj bez powodu)
        highlight:     false
    };

    // MODUŁ 2: wiersz "Resume emails" -> tuż pod wiersz "Auftrag #"
    const CFG2 = {
        enabled:        true,
        buttonText:     'Resume emails', // przycisk identyfikujący przenoszony wiersz
        afterLabelText: 'Auftrag #'      // wstawiamy pod wierszem z tą etykietą
    };

    // MODUŁ 3: kosmetyka przycisków
    const CFG3 = {
        enabled: true,
        accent:  '#750000',  // kolor obramowania przy focusie
        compact: true        // true = ciasne odstępy (strona jest gęsta), false = luźniejsze
    };

    /* ====================================================================== */

    let done = false, tries = 0, formSeq = 0;

    function commonRoot(a, b) {
        const chain = new Set();
        for (let n = a; n; n = n.parentElement) chain.add(n);
        for (let n = b; n; n = n.parentElement) if (chain.has(n)) return n;
        return null;
    }

    function childOf(root, node) {
        let n = node;
        while (n && n.parentElement !== root) n = n.parentElement;
        return n;
    }

    // Przypina pola do ich obecnych formularzy przez atrybut form="..."
    function pinForms(nodes) {
        const ctrls = [];
        nodes.forEach((n) => {
            if (n.matches && n.matches('input,select,textarea,button')) ctrls.push(n);
            if (n.querySelectorAll) ctrls.push.apply(ctrls, n.querySelectorAll('input,select,textarea,button'));
        });
        let pinned = 0, orphans = 0;
        ctrls.forEach((c) => {
            if (c.hasAttribute('form')) return;
            const f = c.form;
            if (f) {
                if (!f.id) f.id = 'tm-form-' + (++formSeq);
                c.setAttribute('form', f.id);
                pinned++;
            } else {
                // pole bez formularza – nie może przypadkiem trafić do form1
                c.setAttribute('form', 'tm-no-form');
                orphans++;
            }
        });
        console.log(LOG + ' przypiętych pól: ' + pinned + ', bez formularza: ' + orphans);
    }

    function buildWrapper(sampleTag, sourceTable) {
        let wrap, host;
        if (sampleTag === 'TR') {
            wrap = document.createElement('table');
            const tb = document.createElement('tbody');
            wrap.appendChild(tb);
            host = tb;
        } else if (sampleTag === 'TD' || sampleTag === 'TH') {
            wrap = document.createElement('table');
            const tb = document.createElement('tbody');
            const tr = document.createElement('tr');
            wrap.appendChild(tb); tb.appendChild(tr);
            host = tr;
        } else {
            wrap = document.createElement('div');
            host = wrap;
        }
        if (wrap.tagName === 'TABLE' && sourceTable) {
            ['class', 'width', 'border', 'cellspacing', 'cellpadding', 'align', 'style'].forEach((a) => {
                if (sourceTable.hasAttribute(a)) wrap.setAttribute(a, sourceTable.getAttribute(a));
            });
        }
        wrap.id = 'tm-articles-moved';
        wrap.style.marginBottom = '12px';
        return { wrap, host };
    }

    function run() {
        if (done) return true;
        if (document.getElementById('tm-articles-moved')) { done = true; return true; }

        const s = document.getElementById(CFG.sourceStartId);
        const e = document.getElementById(CFG.sourceEndId);
        const t = document.getElementById(CFG.targetId);

        if (!s || !e || !t) {
            if (tries > 18) console.warn(LOG + ' brak elementów:', {
                start: !!s, koniec: !!e, cel: !!t
            });
            return false;
        }

        const root = commonRoot(s, e);
        const startN = childOf(root, s);
        const endN = childOf(root, e);
        if (!root || !startN || !endN || startN === endN) {
            console.warn(LOG + ' nie udało się wyznaczyć zakresu do przeniesienia.');
            done = true; return true;
        }

        if (!(startN.compareDocumentPosition(endN) & Node.DOCUMENT_POSITION_FOLLOWING)) {
            console.log(LOG + ' kolejność inna niż oczekiwana – nic nie robię.');
            done = true; return true;
        }

        const nodes = [];
        for (let n = startN; n && n !== endN; n = n.nextElementSibling) nodes.push(n);

        const targetTable = t.closest('table');
        const targetParent = targetTable && targetTable.parentElement;
        if (!targetParent) {
            console.warn(LOG + ' nie znaleziono miejsca docelowego przy #' + CFG.targetId);
            done = true; return true;
        }

        console.log(LOG + ' przenoszę ' + nodes.length + ' element(ów) <' + nodes[0].tagName.toLowerCase() +
            '> nad sekcję #' + CFG.targetId);

        if (CFG.pinForms) pinForms(nodes);

        const built = buildWrapper(nodes[0].tagName, root.closest ? root.closest('table') : null);
        nodes.forEach((n) => built.host.appendChild(n));
        targetParent.insertBefore(built.wrap, targetTable);

        if (CFG.highlight) {
            built.wrap.style.outline = '2px solid #750000';
            setTimeout(() => { built.wrap.style.outline = ''; }, 1500);
        }

        console.log(LOG + ' gotowe – sekcja Articles jest nad Calculation Tables.');
        done = true;
        return true;
    }


    /* ---------------------- MODUŁ 2: Resume emails ----------------------- */
    let done2 = false;

    function findControlByText(txt) {
        const want = txt.replace(/\s+/g, ' ').trim().toLowerCase();
        const all = Array.from(document.querySelectorAll('input[type=button],input[type=submit],button,a'));
        return all.find((el) => {
            const v = (el.value || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return v === want;
        }) || null;
    }

    function findLabelCell(txt) {
        const want = txt.replace(/\s+/g, ' ').trim().toLowerCase();
        const cells = Array.from(document.querySelectorAll('td,th'));
        const hit = cells.filter((c) => {
            const v = (c.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return v === want || v.startsWith(want);
        });
        hit.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
        return hit[0] || null;
    }

    function runResumeEmails() {
        if (done2 || !CFG2.enabled) return true;
        if (document.querySelector('[data-tm-resume-moved]')) { done2 = true; return true; }

        const ctrl = findControlByText(CFG2.buttonText);
        const label = findLabelCell(CFG2.afterLabelText);

        if (!ctrl || !label) {
            if (tries > 18) console.warn(LOG + ' [resume] nie znaleziono:', {
                przycisk: !!ctrl, etykieta: !!label
            });
            return false;
        }

        const srcRow = ctrl.closest('tr');
        const tgtRow = label.closest('tr');
        if (!srcRow || !tgtRow || srcRow === tgtRow) {
            console.warn(LOG + ' [resume] brak wiersza źródłowego lub docelowego.');
            done2 = true; return true;
        }
        if (srcRow.contains(tgtRow) || tgtRow.contains(srcRow)) {
            console.warn(LOG + ' [resume] wiersze są zagnieżdżone w sobie – przerywam.');
            done2 = true; return true;
        }

        if (CFG.pinForms) pinForms([srcRow]);

        // dopasowanie liczby kolumn do tabeli docelowej
        const tgtCells = tgtRow.children.length;
        const srcCells = srcRow.children.length;
        if (srcCells < tgtCells && srcCells > 0) {
            srcRow.children[srcCells - 1].setAttribute('colspan', String(tgtCells - srcCells + 1));
        }

        srcRow.setAttribute('data-tm-resume-moved', '1');
        tgtRow.parentNode.insertBefore(srcRow, tgtRow.nextSibling);

        console.log(LOG + ' [resume] wiersz "' + CFG2.buttonText + '" przeniesiony pod "' + CFG2.afterLabelText + '".');
        done2 = true;
        return true;
    }
    /* --------------------------------------------------------------------- */


    /* ---------------------- MODUŁ 3: wygląd przycisków ------------------- */
    function styleButtons() {
        if (!CFG3.enabled || document.getElementById('tm-button-styles')) return;

        const pad = CFG3.compact ? '2px 9px' : '4px 12px';
        const css = [
            /* geometria – dotyczy wszystkich przycisków, kolor zostaje nietknięty */
            'input[type="button"], input[type="submit"], input[type="reset"], button {',
            '  font-family: inherit;',
            '  padding: ' + pad + ';',
            '  border: 1px solid rgba(0,0,0,.25);',
            '  border-radius: 5px;',
            '  box-shadow: 0 1px 1px rgba(0,0,0,.07);',
            '  cursor: pointer;',
            '  vertical-align: middle;',
            '  transition: filter .12s ease, box-shadow .12s ease, transform .04s ease;',
            '}',
            /* jasne tło tylko tam, gdzie strona nie ustawia własnego koloru inline */
            'input[type="button"]:not([style*="background"]),',
            'input[type="submit"]:not([style*="background"]),',
            'input[type="reset"]:not([style*="background"]),',
            'button:not([style*="background"]) {',
            '  background-color: #f6f6f6;',
            '  color: #222;',
            '}',
            /* hover / active / focus – działa niezależnie od koloru tła */
            'input[type="button"]:hover, input[type="submit"]:hover,',
            'input[type="reset"]:hover, button:hover {',
            '  filter: brightness(.94);',
            '  box-shadow: 0 1px 3px rgba(0,0,0,.14);',
            '}',
            'input[type="button"]:active, input[type="submit"]:active,',
            'input[type="reset"]:active, button:active {',
            '  transform: translateY(1px);',
            '  box-shadow: inset 0 1px 2px rgba(0,0,0,.15);',
            '}',
            'input[type="button"]:focus-visible, input[type="submit"]:focus-visible,',
            'input[type="reset"]:focus-visible, button:focus-visible {',
            '  outline: 2px solid ' + CFG3.accent + ';',
            '  outline-offset: 1px;',
            '}',
            /* wyłączone przyciski wyraźnie odróżnialne */
            'input[type="button"]:disabled, input[type="submit"]:disabled,',
            'input[type="reset"]:disabled, button:disabled {',
            '  opacity: .5;',
            '  cursor: not-allowed;',
            '  box-shadow: none;',
            '  filter: none;',
            '}'
        ].join('\n');

        const st = document.createElement('style');
        st.id = 'tm-button-styles';
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
        console.log(LOG + ' [buttons] style załadowane');
    }
    /* --------------------------------------------------------------------- */

    console.log(LOG + ' A Better Look – Auftrag v2.0.0 – start');
    styleButtons();

    const timer = setInterval(() => {
        tries++;
        const a = run();
        const b = runResumeEmails();
        if ((a && b) || tries > 20) clearInterval(timer);
    }, 400);

    run();
    runResumeEmails();
})();

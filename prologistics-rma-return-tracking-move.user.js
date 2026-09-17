// ==UserScript==
// @name         Prologistics – RMA – Return Tracking pod Closing Notification
// @namespace    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @version      1.6.1
// @description  Przenosi tabelę "Return tracking numbers", formularz Tracking #/Update oraz przyciski "Label for client" i "Return prices" (razem z tabelą cen po kliknięciu) pod przycisk "Closing Notification" na rma.php – bez tabeli "Tracking numbers" i bez "New driver task"
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-rma-return-tracking-move.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-rma-return-tracking-move.user.js
// ==/UserScript==

(function () {
    'use strict';

    const PREFIX = '[TM script by kimrioter]';
    const BOX_ID = 'kr-rma-moved-box';

    const HARD_STOP = [
        'Attached documents',
        'New comment',
        'Import all articles',
        'Articles:',
        'Closing Notification',
        'Comment Notification',
        'New driver task',
        'Real Return Shipping Prices',
        'Liquidators'
    ];

    // Markery tabeli "Tracking numbers" (packingowej) – ta zostaje na miejscu
    const PACKING_MARKERS = ['Packing date', 'Packed by', '# of shipments', 'Favourite pickup date'];

    // Przyciski pod formularzem – w tej kolejności
    //  mode 'move'  – przenosimy oryginalny przycisk
    //  mode 'proxy' – oryginał zostaje na swoim miejscu (jego skrypt strony działa względem
    //                 pozycji w DOM), a pod formularzem stawiamy przycisk, który go "klika"
    const EXTRA_BUTTONS = [
        { label: 'Label for client', gap: 8, mode: 'move' },
        { label: 'Return prices', gap: 8, mode: 'proxy' }
    ];

    const PROXY_ATTR = 'data-kr-proxy';

    // Ukrywać oryginał przycisku-proxy? Jeśli po kliknięciu okienko/wyniki pojawiają się
    // w złym miejscu (np. w lewym górnym rogu), ustaw na false.
    const HIDE_PROXIED_ORIGINAL = true;

    // Sekcja, w której strona wstawia wyniki po kliknięciu "Return prices"
    const RESULT_SECTION_START = 'Real Return Shipping Prices';
    const RESULT_SECTION_END = ["Liquidators' Prices", 'Liquidators’ Prices', 'Liquidator country'];
    const RESULT_SETTLE_MS = 300;     // odświeżenie kopii po takiej przerwie w zmianach DOM…
    const RESULT_MAX_WAIT_MS = 1000;  // …ale nie rzadziej niż co tyle, nawet gdy DOM ciągle się zmienia
    const RESULT_EMPTY_GRACE_MS = 500; // kopię chowamy, gdy oryginał jest schowany/pusty przez tyle czasu
    const MIRROR_ATTR = 'data-kr-mirrored';
    const STYLE_ID = 'kr-rma-style';

    const log = (...args) => console.log(PREFIX, ...args);
    const txt = el => (el && el.textContent) || '';

    /* ------------------------------------------------------------------ */
    /*  Wyszukiwanie                                                       */
    /* ------------------------------------------------------------------ */

    function findSmallestByText(text, selector = 'td, th, div, span, b, strong, legend, h1, h2, h3, h4') {
        const nodes = [...document.querySelectorAll(selector)].filter(el => txt(el).includes(text));
        if (!nodes.length) return null;
        return nodes.reduce((best, el) => (txt(el).length < txt(best).length ? el : best));
    }

    function findButtonsByLabel(label) {
        return [...document.querySelectorAll('input[type="button"], input[type="submit"], button, a')]
            .filter(el => !el.hasAttribute(PROXY_ATTR))
            .filter(el => (el.value || el.textContent || '').trim() === label);
    }

    const findButtonByLabel = label => findButtonsByLabel(label)[0] || null;

    function findReturnTable(titleEl) {
        let el = titleEl;
        while (el) {
            const table = el.closest('table');
            if (!table) return null;
            const t = txt(table);
            if (t.includes('Return tracking numbers') && !PACKING_MARKERS.some(m => t.includes(m))) {
                return table;
            }
            el = table.parentElement;
        }
        return null;
    }

    const isDirty = t =>
        PACKING_MARKERS.some(m => t.includes(m)) ||
        t.includes('Return tracking numbers') ||
        HARD_STOP.some(s => t.includes(s));

    /* ------------------------------------------------------------------ */
    /*  Formularz Tracking # / Country / Shipping method # / Label / Update */
    /* ------------------------------------------------------------------ */

    // Wariant A: istnieje czysty wspólny kontener – bierzemy go w całości
    function findFormWrapper() {
        for (const btn of findButtonsByLabel('Update')) {
            let el = btn;
            for (let i = 0; i < 8 && el && el !== document.body; i++) {
                const t = txt(el);
                if (isDirty(t)) break;
                if (t.includes('Tracking #') && t.includes('Shipping method #')) return [el];
                el = el.parentElement;
            }
        }
        return null;
    }

    // Wariant B: zakres rodzeństwa od etykiety "Tracking #" do przycisku "Update"
    function findFormRange() {
        const label = [...document.querySelectorAll('td, div, span, b, strong, label, th')]
            .filter(el => txt(el).trim() === 'Tracking #')
            .sort((a, b) => txt(a).length - txt(b).length)[0];
        if (!label) return null;

        const update = findButtonsByLabel('Update').find(btn =>
            label.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (!update) return null;

        // najmniejszy wspólny przodek
        let common = label.parentElement;
        while (common && !common.contains(update)) common = common.parentElement;
        if (!common) return null;

        const childOf = node => {
            let c = node;
            while (c && c.parentElement !== common) c = c.parentElement;
            return c;
        };

        const start = childOf(label);
        const end = childOf(update);
        if (!start || !end) return null;

        const nodes = [];
        let n = start;
        while (n) {
            nodes.push(n);
            if (n === end) break;
            n = n.nextElementSibling;
        }
        if (nodes[nodes.length - 1] !== end) return null;

        const combined = nodes.map(txt).join(' ');
        if (isDirty(combined)) {
            log('Zakres formularza zawiera obcą treść – pomijam przenoszenie formularza.');
            return null;
        }
        return nodes;
    }

    const findTrackingForm = () => findFormWrapper() || findFormRange();

    /* ------------------------------------------------------------------ */
    /*  Przenoszenie                                                       */
    /* ------------------------------------------------------------------ */

    function preserveFormOwnership(node) {
        const list = [...node.querySelectorAll('input, select, textarea, button')];
        if (node.matches && node.matches('input, select, textarea, button')) list.unshift(node);

        list.forEach(ctrl => {
            if (ctrl.hasAttribute('form')) return;
            const form = ctrl.closest('form');
            if (!form || node.contains(form)) return;
            if (!form.id) form.id = 'kr-form-' + Math.random().toString(36).slice(2, 8);
            ctrl.setAttribute('form', form.id);
        });
    }

    // Wiersze tabeli trzeba przenieść do nowej tabeli, inaczej przeglądarka je wyrzuci
    function appendNodes(box, nodes, marginTop) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top: ' + marginTop + 'px';
        box.appendChild(wrap);

        const rowLike = nodes.some(n => ['TR', 'TBODY', 'THEAD', 'TD', 'TH'].includes(n.tagName));

        if (!rowLike) {
            nodes.forEach(n => { preserveFormOwnership(n); wrap.appendChild(n); });
            return;
        }

        const src = nodes[0].closest('table');
        const table = document.createElement('table');
        if (src) {
            ['border', 'cellpadding', 'cellspacing', 'class'].forEach(a => {
                if (src.hasAttribute(a)) table.setAttribute(a, src.getAttribute(a));
            });
        }
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        wrap.appendChild(table);

        nodes.forEach(n => {
            preserveFormOwnership(n);
            if (n.tagName === 'TBODY' || n.tagName === 'THEAD') {
                table.appendChild(n);
            } else if (n.tagName === 'TD' || n.tagName === 'TH') {
                const tr = document.createElement('tr');
                tr.appendChild(n);
                tbody.appendChild(tr);
            } else {
                tbody.appendChild(n);
            }
        });
    }

    // Przenosi pojedynczy przycisk (razem z jego małym formularzem, jeśli ma) na koniec boxa
    function moveButton(box, label, gap) {
        const btn = findButtonByLabel(label);
        if (!btn) return false;
        if (box.contains(btn)) return true;

        const form = btn.closest('form');
        const block = form && !form.contains(box) && txt(form).trim().length < 60 ? form : btn;
        appendNodes(box, [block], gap);
        log('Przeniesiono przycisk "' + label + '".');
        return true;
    }

    /* ------------------------------------------------------------------ */
    /*  Lustro wyników kliknięcia (tabela cen)                             */
    /* ------------------------------------------------------------------ */

    // Oryginalnych wyników NIE przenosimy (strona lub inne skrypty mogą je przerysowywać,
    // co dawało mruganie). Zostają na miejscu, wypchnięte poza ekran przez CSS, a pod przyciskiem
    // pokazujemy ich kopię, odświeżaną tylko wtedy, gdy treść faktycznie się zmieni.
    // Poza ekran, a nie display:none – dzięki temu strona dalej widzi, czy tabela jest
    // pokazana, i ponowne kliknięcie ją chowa (a my chowamy wtedy kopię).

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const st = document.createElement('style');
        st.id = STYLE_ID;
        st.textContent = '[' + MIRROR_ATTR + '] { position: absolute !important; left: -100000px !important; top: 0 !important; }';
        (document.head || document.documentElement).appendChild(st);
    }

    const ROW_TAGS = ['TR', 'TBODY', 'THEAD', 'TD', 'TH'];
    const mirrors = {};

    function startMirror(proxy, label) {
        if (mirrors[label]) { mirrors[label].schedule(); return; }

        let startEl = null, endEl = null, root = null;
        let lastSig = null, timer = null, firstPending = 0, emptyTimer = null;
        const observer = new MutationObserver(onMutations);

        // Namierza sekcję; wywoływane ponownie, gdy strona przerysuje nagłówki
        function locate() {
            startEl = findSmallestByText(RESULT_SECTION_START);
            endEl = RESULT_SECTION_END.map(t => findSmallestByText(t)).find(Boolean) || null;
            root = null;
            if (startEl && endEl) {
                root = startEl.parentElement;
                while (root && !root.contains(endEl)) root = root.parentElement;
            }
            observer.disconnect();
            if (!root) return false;
            observer.observe(root, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'hidden']
            });
            return true;
        }

        const box = () => document.getElementById(BOX_ID);

        const inRange = node =>
            (startEl.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) &&
            (node.compareDocumentPosition(endEl) & Node.DOCUMENT_POSITION_FOLLOWING) &&
            !node.contains(endEl);

        function onMutations(muts) {
            const b = box();
            const relevant = muts.some(m => {
                const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
                if (!el || (b && b.contains(el))) return false;
                if (!startEl.isConnected || !endEl.isConnected) return true;
                return el.contains(startEl) || el.contains(endEl) || inRange(el);
            });
            if (!relevant) return;
            // ukrywamy nowe oryginały od razu (callback observera działa przed malowaniem),
            // żeby nie mignęły w starym miejscu; samą kopię odświeżamy z opóźnieniem
            hideOriginals();
            schedule();
        }

        function currentNodes() {
            if (!startEl || !startEl.isConnected || !endEl || !endEl.isConnected) {
                if (!locate()) return [];
            }
            const b = box();
            const out = [];
            collect(root, out, findButtonsByLabel(label), b);
            return out;
        }

        function hideOriginals(nodes = currentNodes()) {
            if (!nodes.length) return nodes;
            ensureStyle();
            nodes.forEach(n => { if (!n.hasAttribute(MIRROR_ATTR)) n.setAttribute(MIRROR_ATTR, ''); });
            return nodes;
        }

        function schedule() {
            const now = Date.now();
            if (!firstPending) firstPending = now;
            clearTimeout(timer);
            const wait = Math.max(0, Math.min(RESULT_SETTLE_MS, firstPending + RESULT_MAX_WAIT_MS - now));
            timer = setTimeout(refresh, wait);
        }

        // Zbiera aktualne węzły wyników między nagłówkami sekcji
        function collect(node, out, originals, b) {
            if (node.nodeType !== 1) return;
            if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT'].includes(node.tagName)) return;
            if (b && b.contains(node)) return;

            const t = txt(node);
            const blocked =
                t.includes(RESULT_SECTION_START) ||
                RESULT_SECTION_END.some(e => t.includes(e)) ||
                (b && node.contains(b)) ||
                originals.some(o => node.contains(o));

            if (blocked) {
                [...node.children].forEach(c => collect(c, out, originals, b));
                return;
            }
            if (!inRange(node)) return;
            if (!node.getClientRects().length) return;   // schowane przez stronę (samo lub przodek)
            if (!t.trim() && !node.querySelector('table, img')) return;
            out.push(node);
        }

        function refresh() {
            firstPending = 0;
            const out = hideOriginals();

            if (!out.length) {
                // Pusto: albo strona schowała wyniki (ponowne kliknięcie), albo akurat przerysowuje.
                // Kopię chowamy dopiero, gdy pusto utrzyma się chwilę – bez mrugania.
                if (lastSig !== null && !emptyTimer) {
                    emptyTimer = setTimeout(() => {
                        emptyTimer = null;
                        if (!currentNodes().length) clearMirror();
                    }, RESULT_EMPTY_GRACE_MS);
                }
                return;
            }
            clearTimeout(emptyTimer);
            emptyTimer = null;

            const sig = out.map(n => n.tagName + ':' + n.innerHTML).join('\u0001');
            if (sig === lastSig) return;
            lastSig = sig;
            render(out);
        }

        function clearMirror() {
            const wrap = document.querySelector('[data-kr-results="' + label + '"]');
            if (wrap) wrap.replaceChildren();
            lastSig = null;
            log('Wyniki "' + label + '" schowane – chowam kopię.');
        }

        function render(nodes) {
            let wrap = document.querySelector('[data-kr-results="' + label + '"]');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.setAttribute('data-kr-results', label);
                wrap.style.cssText = 'margin-top: 6px; overflow: visible';
                (proxy.parentElement || proxy).insertAdjacentElement('afterend', wrap);
            }

            const frag = document.createDocumentFragment();
            let rowTable = null;

            nodes.forEach(n => {
                const clone = n.cloneNode(true);
                // bez id (żeby skrypty strony nie trafiały w kopię) i bez naszego znacznika ukrycia
                [clone, ...clone.querySelectorAll('[id], [' + MIRROR_ATTR + ']')].forEach(el => {
                    el.removeAttribute('id');
                    el.removeAttribute(MIRROR_ATTR);
                });

                if (!ROW_TAGS.includes(n.tagName)) {
                    rowTable = null;
                    frag.appendChild(clone);
                    return;
                }

                // wiersze bez własnej tabeli – składamy je w nową tabelę z atrybutami oryginału
                if (!rowTable) {
                    rowTable = document.createElement('table');
                    const src = n.closest('table');
                    if (src) {
                        ['border', 'cellpadding', 'cellspacing', 'class', 'style'].forEach(a => {
                            if (src.hasAttribute(a)) rowTable.setAttribute(a, src.getAttribute(a));
                        });
                    }
                    rowTable.appendChild(document.createElement('tbody'));
                    frag.appendChild(rowTable);
                }
                if (n.tagName === 'TBODY' || n.tagName === 'THEAD') {
                    rowTable.appendChild(clone);
                } else if (n.tagName === 'TD' || n.tagName === 'TH') {
                    const tr = document.createElement('tr');
                    tr.appendChild(clone);
                    rowTable.tBodies[0].appendChild(tr);
                } else {
                    rowTable.tBodies[0].appendChild(clone);
                }
            });

            wrap.replaceChildren(frag);
            [...wrap.children].forEach(normalize);
            log('Zaktualizowano kopię wyników "' + label + '" pod przyciskiem.');
        }

        if (!locate()) {
            log('Nie znalazłam sekcji "' + RESULT_SECTION_START + '" – wyniki zostaną na swoim miejscu.');
            return;
        }
        mirrors[label] = { schedule };
        schedule();
    }

    // Przycisk-pośrednik: wygląda jak oryginał, a przy kliknięciu wywołuje oryginał w jego miejscu
    function proxyButton(box, label, gap) {
        const existing = box.querySelector('[' + PROXY_ATTR + '="' + label + '"]');
        const original = findButtonByLabel(label);

        if (existing) {
            // strona mogła przerysować sekcję i wstawić nowy oryginał – ukryj go ponownie
            if (original && HIDE_PROXIED_ORIGINAL) original.style.display = 'none';
            return true;
        }
        if (!original) return false;

        const isInput = original.tagName === 'INPUT';
        const proxy = document.createElement(isInput ? 'input' : 'button');
        proxy.type = 'button';
        if (isInput) proxy.value = label; else proxy.textContent = label;
        if (original.className) proxy.className = original.className;
        proxy.setAttribute(PROXY_ATTR, label);

        proxy.addEventListener('click', e => {
            e.preventDefault();
            // szukamy oryginału przy każdym kliknięciu – strona mogła go podmienić
            const target = findButtonByLabel(label);
            if (!target) {
                log('Nie znalazłam oryginalnego przycisku "' + label + '".');
                return;
            }
            startMirror(proxy, label);
            target.click();
            if (HIDE_PROXIED_ORIGINAL) {
                setTimeout(() => {
                    const again = findButtonByLabel(label);
                    if (again) again.style.display = 'none';
                }, 500);
            }
        });

        appendNodes(box, [proxy], gap);
        if (HIDE_PROXIED_ORIGINAL) original.style.display = 'none';
        log('Dodano przycisk-pośrednik "' + label + '".');
        return true;
    }

    // true = wszystkie przyciski są już w boxie
    const moveExtraButtons = box =>
        EXTRA_BUTTONS
            .map(b => (b.mode === 'proxy' ? proxyButton : moveButton)(box, b.label, b.gap))
            .every(Boolean);

    /* ------------------------------------------------------------------ */
    /*  Kontener docelowy                                                  */
    /* ------------------------------------------------------------------ */

    function buildBox(anchor) {
        const box = document.createElement('div');
        box.id = BOX_ID;
        box.style.cssText = 'margin: 10px 0 14px 0; padding: 0; border: 0; background: transparent; display: block; overflow: visible';

        const smallTable = anchor.closest('table');
        if (smallTable && txt(smallTable).trim().length < 400 && smallTable.parentElement) {
            smallTable.insertAdjacentElement('afterend', box);
            return box;
        }

        const row = anchor.closest('tr');
        if (row && row.parentElement) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = Math.max(row.children.length, 1);
            td.style.cssText = 'padding: 0; border: 0; overflow: visible';
            td.appendChild(box);
            tr.appendChild(td);
            row.insertAdjacentElement('afterend', tr);
            return box;
        }

        (anchor.parentElement || anchor).insertAdjacentElement('afterend', box);
        return box;
    }

    function normalize(node) {
        if (!node || node.nodeType !== 1) return;
        const fix = el => {
            const ox = getComputedStyle(el).overflowX;
            if (ox === 'auto' || ox === 'scroll') el.style.overflowX = 'visible';
        };
        fix(node);
        node.querySelectorAll('div, table').forEach(fix);
    }

    /* ------------------------------------------------------------------ */
    /*  Główna logika                                                      */
    /* ------------------------------------------------------------------ */

    function run() {
        // Box już stoi – dociągamy tylko przyciski, które mogły dojść później
        const existing = document.getElementById(BOX_ID);
        if (existing) return moveExtraButtons(existing);

        const closingBtn = findButtonByLabel('Closing Notification');
        if (!closingBtn) return false;

        const titleEl = findSmallestByText('Return tracking numbers');
        if (!titleEl) return false;

        const returnTable = findReturnTable(titleEl);
        if (!returnTable) return false;

        // Formularz namierzamy PRZED przenoszeniem tabeli, żeby DOM się nie zmienił pod nogami
        const formNodes = findTrackingForm();

        const box = buildBox(closingBtn);

        // 1. Tabela zwrotów
        preserveFormOwnership(returnTable);
        box.appendChild(returnTable);
        normalize(returnTable);

        // 2. Formularz Tracking # / Update – pod tabelą
        if (formNodes && formNodes.length && !formNodes.some(n => box.contains(n))) {
            appendNodes(box, formNodes, 6);
            formNodes.forEach(normalize);
            log('Przeniesiono formularz Tracking #/Update (' + formNodes.length + ' węzeł/y).');
        } else if (!formNodes) {
            log('Nie znalazłam formularza Tracking #/Update – został na swoim miejscu.');
        }

        // 3. Przyciski "Label for client" + "Return prices"
        const allMoved = moveExtraButtons(box);

        log('Gotowe – blok siedzi pod "Closing Notification".');
        return allMoved;
    }

    /* ------------------------------------------------------------------ */
    /*  Start + obserwator                                                 */
    /* ------------------------------------------------------------------ */

    if (run()) return;

    const observer = new MutationObserver(() => {
        if (run()) observer.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        observer.disconnect();
        const box = document.getElementById(BOX_ID);
        if (!box) {
            log('Nie znalazłam wymaganych elementów na tej stronie – skrypt nieaktywny.');
        } else if (!moveExtraButtons(box)) {
            log('Nie wszystkie przyciski się pojawiły – brakujące zostały na swoim miejscu.');
        }
    }, 20000);
})();

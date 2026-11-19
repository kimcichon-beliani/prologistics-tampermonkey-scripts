// ==UserScript==
// @name         Prologistics – International VAT (Change order) pod Customer Details
// @namespace    https://github.com/kimcichon-beliani/prologistics-tampermonkey-scripts
// @version      1.2.0
// @description  Na auction.php pod tabelą "Customer Details" wstawia sekcję International VAT z "Change order" (Verify VAT, Goods should be sent without VAT, Make 0% VAT Invoice). Po "Dalej" sam przechodzi krok 2 i klika "Change order" w kroku 3.
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
    const MAX_FULL_HEIGHT = 800;   // wysokość okienka w trybie "cała strona"
    const CLICK_DELAY = 300;       // ms przed automatycznym kliknięciem
    const STUCK_TIMEOUT = 4000;    // ms – jeśli po kliknięciu nic się nie dzieje, pokazujemy stronę

    // false = Change order ładuje się dopiero po kliknięciu "Załaduj"
    const AUTO_LOAD = false;

    // true = popup "Total changed from ... Do you want to change the order?" w kroku 3
    // klikany jest automatycznie na "Yes" (inne pytania, np. o custom shipping, pokazują się w panelu)
    const AUTO_ACCEPT_TOTAL_CHANGE = true;

    // Elementy z kroku 1 Change order, które zostają widoczne
    const KEEP_IDS = [
        'vat_country',          // select z krajem
        'customer_vat',         // numer VAT
        'verify_vat',           // Verify VAT
        'vat_valid_result',     // wynik weryfikacji
        'customer_vat_apply',   // Goods should be sent without VAT
        'customer_vat_clear',   // Undo send WITH VAT
        'customer_vat_make_0',  // Make 0% VAT Invoice
        'customer_vat_undo_0',  // Undo 0% VAT Invoice
        'submit-button'         // Dalej
    ];

    const cdCell = document.getElementById('customer_details');
    const cdTable = cdCell && cdCell.closest('table');
    if (!cdTable) {
        console.log(LOG, 'Brak tabeli Customer Details – skrypt nic nie robi.');
        return;
    }
    if (document.getElementById('tmkr-vat-panel')) return;

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
            #tmkr-vat-panel .tmkr-status.ok { color: #1b7a1b; font-weight: bold; }
            #tmkr-vat-panel .tmkr-confirm { display: none; margin: 4px 8px 8px; padding: 6px 8px; border: 1px solid ${BRAND}; border-radius: 3px; background: #fff4f4; }
            #tmkr-vat-panel .tmkr-confirm-msg { margin-bottom: 6px; font-weight: bold; }
            #tmkr-vat-panel .tmkr-confirm button { margin-right: 6px; padding: 2px 12px; cursor: pointer; }
            #tmkr-vat-panel .tmkr-confirm .tmkr-yes { background: ${BRAND}; color: #fff; border: 0; border-radius: 3px; }
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
        <div class="tmkr-confirm">
            <div class="tmkr-confirm-msg"></div>
            <button type="button" class="tmkr-yes">Tak, zmień</button>
            <button type="button" class="tmkr-no">Nie</button>
        </div>
        <iframe name="${IFRAME_NAME}" title="Change order – International VAT"></iframe>
    `;
    cdTable.insertAdjacentElement('afterend', panel);

    const btnLoad = panel.querySelector('.tmkr-load');
    const btnFull = panel.querySelector('.tmkr-full');
    const statusEl = panel.querySelector('.tmkr-status');
    const confirmBox = panel.querySelector('.tmkr-confirm');
    const confirmMsg = panel.querySelector('.tmkr-confirm-msg');
    const iframe = panel.querySelector('iframe');

    // mode: 'vat' (sekcja VAT z kroku 1), 'auto' (okienko ukryte, skrypt klika), 'full' (cała strona)
    let mode = 'vat';
    let isolated = false;
    let loadCount = 0;
    let lastAutoStep = null;     // zabezpieczenie przed pętlą
    let finalSubmitted = false;  // kliknięto "Change order" w kroku 3
    let frameObs = null;
    let stuckTimer = null;
    let pendingConfirm = null;   // { yes, no } – przyciski alertify w iframe
    let confirmPoll = null;      // sprawdzanie popupu w kroku 3

    function setStatus(text, kind) {
        statusEl.textContent = text;
        statusEl.classList.toggle('err', kind === 'err');
        statusEl.classList.toggle('ok', kind === 'ok');
    }

    function frameDoc() {
        try { return iframe.contentDocument; } catch (e) { return null; }
    }

    function isVisible(el) {
        return !!el && el.getClientRects().length > 0;
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

    // ---------- Krok 1: wycięcie sekcji VAT ----------
    function injectStyle(doc) {
        if (doc.getElementById('tmkr-iso-style')) return;
        const st = doc.createElement('style');
        st.id = 'tmkr-iso-style';
        st.textContent = `
            html:not(.tmkr-full) .tmkr-hide,
            html:not(.tmkr-full).tmkr-iso > *:not(head):not(body),
            html:not(.tmkr-full).tmkr-iso body > *:not(.tmkr-path):not(.tmkr-keep),
            html:not(.tmkr-full) .tmkr-path > *:not(.tmkr-path):not(.tmkr-keep) { display: none !important; }
            html:not(.tmkr-full).tmkr-iso, html:not(.tmkr-full).tmkr-iso body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; background: #fff !important; }
            html:not(.tmkr-full).tmkr-iso body { padding: 6px 8px !important; font: 12px Arial, sans-serif; }
            html:not(.tmkr-full) #customer_vat_apply,
            html:not(.tmkr-full) #customer_vat_clear,
            html:not(.tmkr-full) #customer_vat_make_0,
            html:not(.tmkr-full) #customer_vat_undo_0 { margin: 3px 3px 3px 0; }
            html:not(.tmkr-full) #submit-button { font-weight: bold; color: ${BRAND}; }
        `;
        (doc.head || doc.documentElement).appendChild(st);
    }

    function isolateVatSection(doc) {
        const keep = KEEP_IDS.map(id => doc.getElementById(id)).filter(Boolean);
        const keepSet = new Set(keep);
        keep.forEach(el => {
            const next = el.nextElementSibling;
            if (next && next.tagName === 'BR') keepSet.add(next);
        });

        const onPath = new Set();
        keep.forEach(el => {
            let n = el.parentElement;
            while (n && n !== doc.documentElement) { onPath.add(n); n = n.parentElement; }
        });

        // CSS chowa wszystko poza oznaczoną ścieżką – także elementy dodane później
        // przez inne skrypty (np. pasek "Currently tracking")
        doc.documentElement.classList.add('tmkr-iso');
        onPath.forEach(n => n.classList.add('tmkr-path'));
        keepSet.forEach(n => n.classList.add('tmkr-keep'));

        onPath.forEach(anc => {
            Array.from(anc.childNodes).forEach(child => {
                if (child.nodeType === 3 && child.textContent.trim()) {
                    const wrap = doc.createElement('span');
                    wrap.className = 'tmkr-hide';
                    child.replaceWith(wrap);
                    wrap.appendChild(child);
                }
            });
        });
        return keep.length;
    }

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

    // "Adres na fakturze taki sam jak adres dostawy" – ma być zawsze odznaczone.
    // click() zamiast samego .checked, żeby zadziałały skrypty strony podpięte pod checkbox.
    function ensureSameAddressUnchecked(doc) {
        const cb = doc.getElementById('same_address');
        if (!cb || !cb.checked) return;
        cb.click();
        if (cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
        console.log(LOG, 'Odznaczono "Adres na fakturze taki sam jak adres dostawy".');
    }

    function guardSameAddress(doc) {
        ensureSameAddressUnchecked(doc);
        // strona może zaznaczyć go z opóźnieniem – sprawdzamy jeszcze kilka razy
        [300, 1000, 2000].forEach(ms => setTimeout(() => ensureSameAddressUnchecked(doc), ms));
        // i zawsze tuż przed wysłaniem kroku 1
        const form = (doc.getElementById('submit-button') || {}).form;
        if (form) form.addEventListener('submit', () => ensureSameAddressUnchecked(doc), true);
        const next = doc.getElementById('submit-button');
        if (next) next.addEventListener('click', () => ensureSameAddressUnchecked(doc), true);
    }

    // ---------- Wysokość / tryby ----------
    function fitHeight() {
        const doc = frameDoc();
        if (!doc || !doc.body) return;
        if (mode === 'auto') { iframe.style.height = '0'; return; }
        if (mode === 'full') { iframe.style.height = MAX_FULL_HEIGHT + 'px'; return; }
        const win = iframe.contentWindow;
        let bottom = 0;
        doc.querySelectorAll('.tmkr-keep').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.height > 0) bottom = Math.max(bottom, r.bottom + win.scrollY);
        });
        iframe.style.height = Math.ceil(bottom + 10) + 'px';
    }

    function setMode(newMode) {
        mode = newMode;
        btnFull.textContent = mode === 'full' ? (isolated ? 'Pokaż tylko VAT' : 'Ukryj stronę') : 'Pokaż całą stronę';
        const doc = frameDoc();
        if (doc && doc.documentElement) doc.documentElement.classList.toggle('tmkr-full', mode === 'full');
        fitHeight();
    }

    // Zatrzymanie automatu – pokazujemy całą stronę, żeby było widać, co się stało
    function stopAuto(msg) {
        clearTimeout(stuckTimer);
        clearInterval(confirmPoll);
        lastAutoStep = null;
        finalSubmitted = false;
        hideConfirm();
        setMode('full');
        setStatus(msg, 'err');
        console.warn(LOG, msg);
    }

    function armStuckTimer(msg) {
        clearTimeout(stuckTimer);
        stuckTimer = setTimeout(() => {
            if (!pendingConfirm) stopAuto(msg);
        }, STUCK_TIMEOUT);
    }

    // ---------- Potwierdzenia alertify w kroku 3 ----------
    function hideConfirm() {
        pendingConfirm = null;
        confirmBox.style.display = 'none';
    }

    function btnLabel(b) {
        return (b.tagName === 'INPUT' ? b.value : b.textContent || '').trim();
    }

    // Szuka widocznego okienka z "Total changed..." / "Custom shipping cost..." i jego przycisków Yes/No
    function findAlertifyConfirm(doc) {
        const buttons = Array.from(doc.querySelectorAll('button, a, input[type="button"]')).filter(isVisible);
        const yes = buttons.find(b => /^(yes|ok)$/i.test(btnLabel(b)) &&
            /total changed|do you wish to continue|change the order/i.test((b.closest('div, section, form') || {}).textContent || '') &&
            !b.dataset.tmkrSeen);
        if (!yes) return null;

        let box = yes.parentElement;
        while (box && box !== doc.body && !/total changed|do you wish to continue/i.test(box.textContent)) {
            box = box.parentElement;
        }
        if (!box) return null;
        const no = Array.from(box.querySelectorAll('button, a, input[type="button"]')).find(b => /^(no|cancel)$/i.test(btnLabel(b)));
        const msgMatch = box.textContent.replace(/\s+/g, ' ').match(/(Custom shipping cost[^?]*\?|Total changed[^?]*\?)/i);
        return { yes, no, msg: msgMatch ? msgMatch[1] : box.textContent.replace(/\s+/g, ' ').trim() };
    }

    // Okienko alertify z Change order:
    // <div class="dialog"><div><p class="msg">Total changed from € X to € Y. ...</p><nav><button class="cancel">No</button><button class="ok">Yes</button></nav></div></div>
    function findDialog(doc) {
        for (const d of doc.querySelectorAll('.dialog')) {
            const msg = d.querySelector('.msg');
            const ok = d.querySelector('button.ok');
            if (msg && ok && msg.textContent.trim() && !ok.dataset.tmkrSeen) {
                return { yes: ok, no: d.querySelector('button.cancel'), msg: msg.textContent.replace(/\s+/g, ' ').trim() };
            }
        }
        return findAlertifyConfirm(doc); // zapasowo – szukanie po tekście przycisków
    }

    function checkForConfirm() {
        if (lastAutoStep !== '3' || pendingConfirm) return;
        const doc = frameDoc();
        if (!doc || !doc.body) return;
        const c = findDialog(doc);
        if (!c) return;
        clearTimeout(stuckTimer);
        c.yes.dataset.tmkrSeen = '1';

        // "Total changed from ... Do you want to change the order?" – akceptujemy automatycznie
        if (AUTO_ACCEPT_TOTAL_CHANGE && /total changed/i.test(c.msg)) {
            console.log(LOG, 'Automatycznie zaakceptowano:', c.msg);
            setStatus('Krok 3 z 3 – akceptuję zmianę kwoty: ' + c.msg.replace(/\s*Do you want.*$/i, ''));
            c.yes.click();
            armStuckTimer('Po akceptacji zmiany kwoty nic się nie stało – sprawdź krok 3 poniżej.');
            return;
        }
        pendingConfirm = c;
        confirmMsg.textContent = c.msg;
        confirmBox.style.display = 'block';
        setStatus('Krok 3 z 3 – system prosi o potwierdzenie:');
    }

    panel.querySelector('.tmkr-yes').addEventListener('click', () => {
        if (!pendingConfirm) return;
        const { yes } = pendingConfirm;
        hideConfirm();
        setStatus('Zapisuję zmianę…');
        yes.click();
        armStuckTimer('Po potwierdzeniu nic się nie stało – sprawdź stronę w okienku poniżej.');
        setTimeout(checkForConfirm, 300); // możliwe drugie potwierdzenie
    });

    panel.querySelector('.tmkr-no').addEventListener('click', () => {
        if (!pendingConfirm) return;
        const { no } = pendingConfirm;
        if (no) no.click();
        stopAuto('Anulowano – zamówienie nie zostało zmienione. Krok 3 jest widoczny poniżej.');
    });

    // ---------- Kroki 2 i 3 – automatyczne przeklikanie ----------
    function isOrderChangedPage(doc) {
        const h1 = doc.querySelector('h1.header-title');
        return (h1 && /order changed/i.test(h1.textContent)) ||
            !!doc.querySelector('.order4_wrap a[href*="auction.php"]');
    }

    function getStep(doc) {
        const s = doc.querySelector('form input[name="step"]');
        return s ? String(s.value) : null;
    }

    function autoStep2(doc) {
        if (lastAutoStep === '2') return stopAuto('Krok 2 załadował się ponownie – sprawdź komunikat poniżej.');
        const err = doc.getElementById('errortext_div');
        if (isVisible(err) && err.textContent.trim()) return stopAuto('Krok 2 zgłosił błąd – sprawdź poniżej.');
        const btn = doc.querySelector('#theform input[type="submit"][name="proceed"]');
        if (!btn) return stopAuto('Nie znalazłam „Dalej” w kroku 2.');

        lastAutoStep = '2';
        setMode('auto');
        setStatus('Krok 2 z 3 (produkty) – przechodzę dalej…');
        setTimeout(() => btn.click(), CLICK_DELAY);
        armStuckTimer('Krok 2 nie przeszedł dalej – sprawdź poniżej.');
    }

    function autoStep3(doc) {
        if (lastAutoStep === '3') return stopAuto('Krok 3 załadował się ponownie – sprawdź komunikat poniżej.');
        const btn = doc.getElementById('change_button');
        if (!btn) return stopAuto('Nie znalazłam „Change order” w kroku 3.');

        const terms = doc.getElementById('terms');
        if (terms && !terms.checked) terms.checked = true; // inaczej submitCards() blokuje zapis

        lastAutoStep = '3';
        finalSubmitted = true;
        setMode('auto');
        setStatus('Krok 3 z 3 – klikam „Change order”…');
        setTimeout(() => {
            btn.click();
            // popup może się pokazać z opóźnieniem – sprawdzamy co 250 ms aż do przejścia dalej
            clearInterval(confirmPoll);
            confirmPoll = setInterval(checkForConfirm, 250);
        }, CLICK_DELAY);
        armStuckTimer('„Change order” nie zadziałał – sprawdź krok 3 poniżej.');
    }

    // ---------- Obsługa kolejnych załadowań iframe ----------
    iframe.addEventListener('load', () => {
        const doc = frameDoc();
        if (doc && doc.location.href === 'about:blank') return;

        clearTimeout(stuckTimer);
        clearInterval(confirmPoll);
        hideConfirm();

        if (!doc || !doc.body) {
            setStatus('Nie udało się osadzić Change order (strona blokuje ramki?). Otwórz Change order normalnie.', 'err');
            console.warn(LOG, 'Brak dostępu do dokumentu w iframe.');
            return;
        }

        loadCount++;
        injectStyle(doc);
        btnFull.disabled = false;
        isolated = false;

        if (frameObs) frameObs.disconnect();
        let t = null;
        frameObs = new iframe.contentWindow.MutationObserver(() => {
            clearTimeout(t);
            t = setTimeout(() => { fitHeight(); checkForConfirm(); }, 100);
        });
        frameObs.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });

        const step = getStep(doc);
        const backOnAuction = /\/auction\.php$/i.test(doc.location.pathname) && !!doc.getElementById('customer_details');
        console.log(LOG, 'Change order – załadowano stronę, krok:', step);

        if (doc.getElementById('customer_vat_apply')) {
            // Krok 1 – sekcja VAT
            lastAutoStep = null;
            finalSubmitted = false;
            const kept = isolateVatSection(doc);
            isolated = true;
            prefillFromAuction(doc);
            guardSameAddress(doc);
            setMode('vat');
            setStatus('Wybierz kraj, wpisz numer VAT → Verify VAT → przycisk VAT → „Dalej”. Kroki 2 i 3 skrypt przeklika sam.');
            console.log(LOG, 'Sekcja VAT załadowana, zachowane elementy:', kept);
        } else if (step === '2' && doc.getElementById('theform')) {
            autoStep2(doc);
        } else if (step === '3' && doc.getElementById('change_button')) {
            autoStep3(doc);
        } else if (isOrderChangedPage(doc)) {
            // Strona "Order changed ... Click here to return to auction page" – nie trzeba klikać "here"
            lastAutoStep = null;
            finalSubmitted = false;
            setMode('auto');
            setStatus('Zamówienie zmienione – odświeżam stronę…', 'ok');
            console.log(LOG, 'Strona "Order changed" – przeładowanie auftragu.');
            setTimeout(() => location.reload(), 800);
        } else if (loadCount > 1 && (backOnAuction || finalSubmitted)) {
            setMode('auto');
            setStatus('Zamówienie zmienione – odświeżam stronę…', 'ok');
            console.log(LOG, 'Change order zakończony, przeładowanie strony.');
            setTimeout(() => location.reload(), 800);
        } else {
            setMode('full');
            setStatus(loadCount === 1
                ? 'Nie znaleziono sekcji International VAT na stronie Change order – pokazuję całą stronę.'
                : 'Nieznany krok Change order – pokazuję całą stronę.', 'err');
        }
    });

    // ---------- Przyciski panelu ----------
    function load() {
        const trigger = findChangeOrderTrigger();
        if (!trigger) {
            setStatus('Nie znalazłam przycisku/linku „Change order” na tej stronie.', 'err');
            return;
        }
        loadCount = 0;
        lastAutoStep = null;
        finalSubmitted = false;
        hideConfirm();
        setStatus('Ładuję Change order…');
        if (!openChangeOrderInFrame(trigger)) {
            setStatus('Nie umiem otworzyć „Change order” z tego przycisku (brak adresu i formularza).', 'err');
            console.warn(LOG, 'Nieobsługiwany trigger Change order:', trigger);
            return;
        }
        btnLoad.textContent = 'Załaduj ponownie';
    }

    btnLoad.addEventListener('click', load);
    btnFull.addEventListener('click', () => {
        if (mode === 'full') setMode(isolated ? 'vat' : 'auto');
        else setMode('full');
    });

    if (AUTO_LOAD) load();
    console.log(LOG, 'International VAT (Change order) – panel dodany.');
})();

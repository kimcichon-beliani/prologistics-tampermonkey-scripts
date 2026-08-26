// ==UserScript==
// @name         Express Label Generator — Prologistics (Fixed)
// @namespace    https://www.prologistics.info/
// @version      1.4
// @description  Klik "Label for client" -> label pobiera sie od razu jako "Label Ticket <nr>.pdf" (bez nowej karty). Dodatkowo: e-mail w Customer Data przestaje byc linkiem.
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @match        https://prologistics.info/rma.php*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/express-label-generator.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/express-label-generator.user.js
// ==/UserScript==

(function () {
    'use strict';
    const TAG = '[TM Express Label Generator by kimrioter]';
    console.log(TAG, 'Start v1.4');

    /* =========================================================
       USTAWIENIA
       ========================================================= */

    const AUTO_DOWNLOAD      = true;   // false = stare zachowanie (nowa karta)
    const ALSO_OPEN_PREVIEW  = false;  // dodatkowo otworzyc podglad w karcie
    const FILE_NAME_PATTERN  = 'Label Ticket {nr}.pdf';
    const DEBUG              = true;   // logi w konsoli

    // Parametry barcode.php uzywane, gdy nie da sie ich odczytac ze strony
    const DEFAULT_PARAMS = {
        barwidth: '2',
        height: '80',
        export: 'pdf',
        type: 'ticket',
        warehouse_id: '0'
    };

    const log = (...a) => { if (DEBUG) console.log(TAG, ...a); };

    /* =========================================================
       CZESC 1 — Express Label + auto-download
       ========================================================= */

    let busy = false;

    // --- Numer ticketu -------------------------------------------------
    function getTicketNumber() {
        const h = document.body.innerText.match(/Ticket\s*#\s*(\d+)/i);
        if (h) return h[1];
        const u = location.search.match(/[?&](?:id|ticket|ticket_id|rma_id)=(\d+)/i);
        if (u) return u[1];
        return 'unknown';
    }

    function buildFileName() {
        return FILE_NAME_PATTERN
            .replace('{nr}', getTicketNumber())
            .replace(/[\\/:*?"<>|]/g, '-');
    }

    // --- Toast ---------------------------------------------------------
    function toast(msg, isError) {
        let box = document.getElementById('tm-label-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'tm-label-toast';
            box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:999999;' +
                'background:#750000;color:#fff;padding:10px 16px;font:13px/1.4 Arial,sans-serif;' +
                'border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.35);max-width:340px;';
            document.body.appendChild(box);
        }
        box.style.background = isError ? '#8a1f1f' : '#750000';
        box.textContent = msg;
        box.style.display = 'block';
        clearTimeout(box._t);
        box._t = setTimeout(() => { box.style.display = 'none'; }, 4000);
    }

    // --- Zapis na dysk --------------------------------------------------
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);

        if (ALSO_OPEN_PREVIEW) {
            const p = URL.createObjectURL(blob);
            nativeOpen.call(window, p, '_blank');
            setTimeout(() => URL.revokeObjectURL(p), 60000);
        }
    }

    async function downloadFromUrl(url) {
        const filename = buildFileName();
        log('Pobieram z URL:', url, '->', filename);
        toast('Generuje label...');
        try {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const blob = await res.blob();
            if (blob.size < 100) throw new Error('Pusta odpowiedz');
            downloadBlob(blob, filename);
            toast('Pobrano: ' + filename);
            return true;
        } catch (err) {
            console.warn(TAG, 'Blad pobierania:', err, url);
            toast('Nie udalo sie pobrac - otwieram w karcie', true);
            nativeOpen.call(window, url, '_blank');
            return false;
        }
    }

    // --- Skladanie URL-a labela ----------------------------------------

    // Warehouse wybrany w modalu (jesli jest)
    function readWarehouseId() {
        const sel = document.querySelector(
            'select[name*="warehouse" i], input[name*="warehouse" i]:checked'
        );
        if (sel && sel.value !== '') return sel.value;
        return DEFAULT_PARAMS.warehouse_id;
    }

    function buildDefaultLabelUrl() {
        const u = new URL('/barcode.php', location.origin);
        u.searchParams.set('number', getTicketNumber());
        u.searchParams.set('barwidth', DEFAULT_PARAMS.barwidth);
        u.searchParams.set('height', DEFAULT_PARAMS.height);
        u.searchParams.set('export', DEFAULT_PARAMS.export);
        u.searchParams.set('type', DEFAULT_PARAMS.type);
        u.searchParams.set('warehouse_id', readWarehouseId());
        return u.toString();
    }

    // URL z formularza (GET) — jesli "Show label" jednak siedzi w formie
    function urlFromForm(form, submitBtn) {
        const action = form.getAttribute('action') || location.href;
        const u = new URL(action, location.href);
        const fd = new FormData(form);
        if (submitBtn && submitBtn.name) fd.set(submitBtn.name, submitBtn.value || '');
        for (const [k, v] of fd.entries()) {
            if (typeof v === 'string') u.searchParams.set(k, v);
        }
        return u.toString();
    }

    // URL z atrybutu onclick / href przycisku
    function urlFromButtonAttrs(btn) {
        const raw = (btn.getAttribute('onclick') || '') + ' ' + (btn.getAttribute('href') || '');
        const m = raw.match(/(barcode\.php\?[^'"\s)]+)/i);
        return m ? new URL(m[1], location.href).toString() : null;
    }

    function findShowLabelButton() {
        const all = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button, a'));
        return all.find(el => el.value === 'Show label' || el.textContent.trim() === 'Show label');
    }

    // --- Ukrycie modala -------------------------------------------------
    function hideWarehouseModal() {
        document.querySelectorAll('.ui-dialog, .blockUI, .ui-widget-overlay, [class*="dialog"]').forEach(el => {
            if (el.textContent.includes('Choose warehouse') || el.classList.contains('ui-widget-overlay')) {
                el.style.display = 'none';
                const close = el.querySelector('.ui-dialog-titlebar-close, .ui-icon-closethick');
                if (close) close.click();
            }
        });
    }

    // --- Glowny przeplyw -------------------------------------------------
    function resolveAndDownload(attempt = 0) {
        const btn = findShowLabelButton();

        // Czekamy max ~1.5 s na modal; jesli go nie ma, skladamy URL sami
        if (!btn && attempt < 30) {
            setTimeout(() => resolveAndDownload(attempt + 1), 50);
            return;
        }

        let url = null;
        if (btn) {
            const form = btn.closest('form');
            log('Znaleziono "Show label". Form:', !!form, 'onclick:', btn.getAttribute('onclick'));
            if (form && /barcode\.php/i.test(form.getAttribute('action') || '')) {
                url = urlFromForm(form, btn);
            } else {
                url = urlFromButtonAttrs(btn);
            }
        } else {
            log('Nie znalazlem "Show label" - skladam URL domyslny');
        }

        if (!url) url = buildDefaultLabelUrl();

        hideWarehouseModal();
        downloadFromUrl(url).then(() => { busy = false; });
        setTimeout(hideWarehouseModal, 300);
    }

    /* --- Przechwycenie window.open (siatka bezpieczenstwa) -------------- */
    const nativeOpen = window.open;
    window.open = function (url, ...rest) {
        if (AUTO_DOWNLOAD && url && /barcode\.php/i.test(String(url))) {
            log('Przechwycone window.open ->', url);
            downloadFromUrl(new URL(String(url), location.href).toString());
            return { closed: false, close() {}, focus() {}, blur() {}, document: {} };
        }
        return nativeOpen.apply(this, [url, ...rest]);
    };

    /* --- Przechwycenie natywnego submitu formularza --------------------- */
    document.addEventListener('submit', (e) => {
        if (!AUTO_DOWNLOAD) return;
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        const action = form.getAttribute('action') || '';
        if (!/barcode\.php/i.test(action)) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        log('Przechwycony submit formularza ->', action);
        hideWarehouseModal();
        downloadFromUrl(urlFromForm(form, null));
    }, true);

    /* --- Klik w "Label for client" -------------------------------------- */
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t) return;
        const isBtn = t.value === 'Label for client' || t.textContent.trim() === 'Label for client';
        if (!isBtn) return;

        if (!AUTO_DOWNLOAD) return;
        if (busy) return;
        busy = true;
        log('Klik "Label for client"');
        setTimeout(() => resolveAndDownload(), 120);
        setTimeout(() => { busy = false; }, 8000); // awaryjne odblokowanie
    }, true);

    /* =========================================================
       CZESC 2 — E-mail bez linka (Customer Data)
       ========================================================= */

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const MARK_CLASS = 'tm-email-plain';

    function injectEmailStyles() {
        if (document.getElementById('tm-email-plain-style')) return;
        const style = document.createElement('style');
        style.id = 'tm-email-plain-style';
        style.textContent =
            '.' + MARK_CLASS + '{cursor:text;user-select:all;-webkit-user-select:all;-moz-user-select:all;' +
            'color:#000;text-decoration:none;border-bottom:1px dotted #999;}' +
            '.' + MARK_CLASS + '.tm-email-copied{background:#750000;color:#fff;border-bottom-color:transparent;}';
        document.head.appendChild(style);
    }

    function copyEmail(span) {
        const text = span.textContent.trim();
        const flash = () => {
            span.classList.add('tm-email-copied');
            setTimeout(() => span.classList.remove('tm-email-copied'), 600);
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(flash).catch(() => {});
        } else {
            const tmp = document.createElement('textarea');
            tmp.value = text;
            document.body.appendChild(tmp);
            tmp.select();
            try { document.execCommand('copy'); flash(); } catch (err) {}
            document.body.removeChild(tmp);
        }
    }

    function unlinkEmail(link) {
        const span = document.createElement('span');
        span.className = MARK_CLASS;
        span.textContent = link.textContent.trim();
        span.title = 'Kliknij, aby zaznaczyc / kliknij dwukrotnie, aby skopiowac';
        span.addEventListener('dblclick', (e) => { e.preventDefault(); copyEmail(span); });
        link.replaceWith(span);
    }

    function unlinkAllEmails() {
        document.querySelectorAll('a[href^="mailto:"]').forEach(unlinkEmail);
        document.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length < 2) return;
            const label = cells[0].textContent.trim().replace(':', '').toLowerCase();
            if (label !== 'email' && label !== 'e-mail') return;
            cells[1].querySelectorAll('a').forEach(a => {
                if (EMAIL_REGEX.test(a.textContent.trim())) unlinkEmail(a);
            });
        });
    }

    injectEmailStyles();
    unlinkAllEmails();

    const emailObserver = new MutationObserver(() => {
        if (document.querySelector('a[href^="mailto:"]')) unlinkAllEmails();
    });
    emailObserver.observe(document.body, { childList: true, subtree: true });

    console.log(TAG, 'Email unlinker aktywny');

})();

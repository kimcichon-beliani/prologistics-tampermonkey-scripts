// ==UserScript==
// @name         Express Label Generator — Prologistics (Fixed)
// @namespace    https://www.prologistics.info/
// @version      1.3
// @description  Bypasses the manual click in "Choose warehouse" modal, auto-submits form and DOWNLOADS the label as "Label Ticket <nr>.pdf". Dodatkowo: e-mail w Customer Data przestaje być linkiem (łatwiejsze kopiowanie).
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/express-label-generator.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/express-label-generator.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM Express Label Generator by kimrioter] Start');

    /* =========================================================
       USTAWIENIA
       ========================================================= */

    // true  -> label pobiera się od razu na dysk pod własną nazwą
    // false -> stare zachowanie (otwarcie labela w nowej karcie)
    const AUTO_DOWNLOAD = true;

    // Dodatkowo otworzyć label w nowej karcie (podgląd) oprócz pobrania?
    const ALSO_OPEN_PREVIEW = false;

    // Wzór nazwy pliku. {nr} = numer ticketu
    const FILE_NAME_PATTERN = 'Label Ticket {nr}.pdf';

    /* =========================================================
       CZĘŚĆ 1 — Express Label + auto-download
       ========================================================= */

    let busy = false; // blokada przed podwójnym wywołaniem

    // --- Numer ticketu -------------------------------------------------
    function getTicketNumber() {
        // 1) Nagłówek strony: "Ticket #670805"
        const h = document.body.innerText.match(/Ticket\s*#\s*(\d+)/i);
        if (h) return h[1];

        // 2) Zapas: parametr w URL (?id=..., ?ticket=...)
        const u = location.search.match(/[?&](?:id|ticket|ticket_id|rma_id)=(\d+)/i);
        if (u) return u[1];

        return 'unknown';
    }

    function buildFileName() {
        return FILE_NAME_PATTERN
            .replace('{nr}', getTicketNumber())
            .replace(/[\\/:*?"<>|]/g, '-'); // znaki niedozwolone w nazwach plików
    }

    // --- Mały toast w kolorze Beliani ----------------------------------
    function toast(msg, isError) {
        let box = document.getElementById('tm-label-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'tm-label-toast';
            box.style.cssText = `
                position: fixed; right: 16px; bottom: 16px; z-index: 999999;
                background: #750000; color: #fff; padding: 10px 16px;
                font: 13px/1.4 Arial, sans-serif; border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,.35); max-width: 320px;
            `;
            document.body.appendChild(box);
        }
        box.style.background = isError ? '#8a1f1f' : '#750000';
        box.textContent = msg;
        box.style.display = 'block';
        clearTimeout(box._t);
        box._t = setTimeout(() => { box.style.display = 'none'; }, 3500);
    }

    // --- Zapis blobu na dysk -------------------------------------------
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
            const previewUrl = URL.createObjectURL(blob);
            window.open(previewUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
        }
    }

    // --- Wysyłka formularza przez fetch (zamiast submit do _blank) ------
    async function fetchFormResponse(form, submitBtn) {
        const action = form.getAttribute('action') || location.href;
        const url = new URL(action, location.href);
        const method = (form.getAttribute('method') || 'GET').toUpperCase();

        const fd = new FormData(form);
        // Przycisk submit też musi trafić do requestu (serwer po nim rozpoznaje akcję)
        if (submitBtn && submitBtn.name) fd.set(submitBtn.name, submitBtn.value || '');

        if (method === 'GET') {
            for (const [k, v] of fd.entries()) url.searchParams.set(k, v);
            return fetch(url.toString(), { credentials: 'include' });
        }

        const isMultipart = (form.enctype || '').includes('multipart');
        return fetch(url.toString(), {
            method: 'POST',
            credentials: 'include',
            body: isMultipart ? fd : new URLSearchParams(fd)
        });
    }

    // --- Wyciągnięcie PDF-a z odpowiedzi HTML (gdyby serwer zwrócił stronę)
    function findPdfUrlInHtml(html, baseUrl) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const candidates = [
            ...doc.querySelectorAll('iframe[src], embed[src], object[data], a[href]')
        ];
        for (const el of candidates) {
            const src = el.getAttribute('src') || el.getAttribute('data') || el.getAttribute('href');
            if (src && /\.pdf(\?|$)/i.test(src)) return new URL(src, baseUrl).toString();
        }
        // Zapas: surowy link do PDF w treści (np. w JS)
        const raw = html.match(/["'`]([^"'`\s]+\.pdf(?:\?[^"'`\s]*)?)["'`]/i);
        return raw ? new URL(raw[1], baseUrl).toString() : null;
    }

    // --- Zapas: gotowy label już podlinkowany w tabeli "Return tracking numbers"
    function findExistingLabelLink() {
        const links = [...document.querySelectorAll('a[href*=".pdf"]')];
        const label = links.find(a => /label/i.test(a.textContent) || /label/i.test(a.href));
        return label ? label.href : null;
    }

    // --- Główna obsługa: pobierz label zamiast otwierać kartę -----------
    async function downloadLabel(form, submitBtn) {
        const filename = buildFileName();
        toast('Generuję label…');

        try {
            const res = await fetchFormResponse(form, submitBtn);
            if (!res.ok) throw new Error('HTTP ' + res.status);

            const ct = (res.headers.get('content-type') || '').toLowerCase();

            // 1) Serwer zwrócił PDF bezpośrednio
            if (ct.includes('pdf')) {
                downloadBlob(await res.blob(), filename);
                toast('Pobrano: ' + filename);
                return true;
            }

            // 2) Serwer zwrócił HTML — szukamy w nim linku do PDF
            if (ct.includes('html') || ct === '') {
                const html = await res.text();
                const pdfUrl = findPdfUrlInHtml(html, res.url || location.href)
                    || findExistingLabelLink();

                if (pdfUrl) {
                    const pdfRes = await fetch(pdfUrl, { credentials: 'include' });
                    if (!pdfRes.ok) throw new Error('PDF HTTP ' + pdfRes.status);
                    downloadBlob(await pdfRes.blob(), filename);
                    toast('Pobrano: ' + filename);
                    return true;
                }
                throw new Error('Nie znalazłem PDF-a w odpowiedzi');
            }

            // 3) Inny typ pliku — i tak zapisujemy
            downloadBlob(await res.blob(), filename);
            toast('Pobrano: ' + filename);
            return true;

        } catch (err) {
            console.warn('[TM Express Label Generator by kimrioter] Auto-download nieudany:', err);
            toast('Auto-pobieranie nieudane — otwieram label w nowej karcie', true);
            return false;
        }
    }

    function hideWarehouseModal() {
        const modalContainers = document.querySelectorAll('.ui-dialog, .blockUI, .ui-widget-overlay, [class*="dialog"]');
        modalContainers.forEach(el => {
            if (el.textContent.includes('Choose warehouse') || el.classList.contains('ui-widget-overlay')) {
                el.style.display = 'none';
                const closeBtn = el.querySelector('.ui-dialog-titlebar-close, .ui-icon-closethick');
                if (closeBtn) closeBtn.click();
            }
        });
    }

    // Stare zachowanie — klasyczny submit do nowej karty
    function submitToNewTab(form, targetBtn) {
        if (form) form.target = '_blank';
        targetBtn.click();
    }

    function autoSubmitWarehouseForm(attempt = 0) {
        // Szukamy przycisku "Show label" w otwartym okienku modalnym
        const showLabelButtons = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button'));
        const targetBtn = showLabelButtons.find(btn => btn.value === 'Show label' || btn.textContent.trim() === 'Show label');

        if (!targetBtn) {
            // Jeśli przycisk jeszcze się nie załadował w DOM, powtarzamy próbę (max ~3 s)
            if (attempt < 60) setTimeout(() => autoSubmitWarehouseForm(attempt + 1), 50);
            else busy = false;
            return;
        }

        const form = targetBtn.closest('form');

        if (!AUTO_DOWNLOAD || !form) {
            submitToNewTab(form, targetBtn);
            setTimeout(hideWarehouseModal, 100);
            busy = false;
            return;
        }

        // Pobieramy label sami, pod własną nazwą
        downloadLabel(form, targetBtn).then(ok => {
            if (!ok) submitToNewTab(form, targetBtn); // fallback: stare zachowanie
            busy = false;
        });

        setTimeout(hideWarehouseModal, 100);
    }

    document.addEventListener('click', (e) => {
        const target = e.target;

        // Po kliknięciu "Label for client"
        if (target && (target.value === 'Label for client' || target.textContent.trim() === 'Label for client')) {
            if (busy) return;
            busy = true;
            // Dajemy ułamek sekundy na wygenerowanie się okienka modalnego
            setTimeout(() => autoSubmitWarehouseForm(), 100);
        }
    }, true);

    /* =========================================================
       CZĘŚĆ 2 — E-mail bez linka (Customer Data)
       Zamienia <a href="mailto:..."> na zwykły tekst.
       Jedno kliknięcie zaznacza cały adres → Ctrl+C.
       Podwójne kliknięcie kopiuje adres do schowka.
       ========================================================= */

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const MARK_CLASS = 'tm-email-plain';

    // Wstrzykujemy style raz, na starcie
    function injectEmailStyles() {
        if (document.getElementById('tm-email-plain-style')) return;
        const style = document.createElement('style');
        style.id = 'tm-email-plain-style';
        style.textContent = `
            .${MARK_CLASS} {
                cursor: text;
                user-select: all;
                -webkit-user-select: all;
                -moz-user-select: all;
                color: #000;
                text-decoration: none;
                border-bottom: 1px dotted #999;
            }
            .${MARK_CLASS}.tm-email-copied {
                background: #750000;
                color: #fff;
                border-bottom-color: transparent;
            }
        `;
        document.head.appendChild(style);
    }

    // Kopiowanie do schowka + krótkie potwierdzenie wizualne
    function copyEmail(span) {
        const text = span.textContent.trim();

        const flash = () => {
            span.classList.add('tm-email-copied');
            setTimeout(() => span.classList.remove('tm-email-copied'), 600);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(flash).catch(() => {});
        } else {
            // Fallback dla starszych przeglądarek / braku uprawnień
            const tmp = document.createElement('textarea');
            tmp.value = text;
            document.body.appendChild(tmp);
            tmp.select();
            try { document.execCommand('copy'); flash(); } catch (err) {}
            document.body.removeChild(tmp);
        }
    }

    // Zamiana <a> na <span> z zachowaniem tekstu
    function unlinkEmail(link) {
        const text = link.textContent.trim();
        const span = document.createElement('span');
        span.className = MARK_CLASS;
        span.textContent = text;
        span.title = 'Kliknij, aby zaznaczyć / kliknij dwukrotnie, aby skopiować';

        span.addEventListener('dblclick', (e) => {
            e.preventDefault();
            copyEmail(span);
        });

        link.replaceWith(span);
    }

    function unlinkAllEmails() {
        // 1) Standardowy przypadek: linki mailto:
        document.querySelectorAll('a[href^="mailto:"]').forEach(unlinkEmail);

        // 2) Zapas: link w wierszu "Email" tabelki Customer Data,
        //    gdyby nie był to mailto (np. link do wyszukiwarki)
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

    // Obserwator na wypadek, gdyby tabelka doładowała się później (AJAX)
    const emailObserver = new MutationObserver(() => {
        if (document.querySelector('a[href^="mailto:"]')) unlinkAllEmails();
    });
    emailObserver.observe(document.body, { childList: true, subtree: true });

    console.log('[TM Express Label Generator by kimrioter] Email unlinker aktywny');

})();

// ==UserScript==
// @name         Prologistics RMA - Shipping Table from Auftrag
// @namespace    kimcichon-beliani
// @version      1.1
// @author       kimrioter
// @description  Dodaje button na stronie RMA, który pobiera tabelę shipping-costs-0 z auction.php (Auftrag) i wyświetla ją w ticketcie
// @match        https://www.prologistics.info/rma.php*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-shipping-table-from-auftrag.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-shipping-table-from-auftrag.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';

    const params = new URLSearchParams(window.location.search);
    const number = params.get('number');
    const txnid = params.get('txnid');

    if (!number || !txnid) return; // to nie jest strona ticketu z numerem aukcji

    const auctionUrl = `https://www.prologistics.info/auction.php?number=${encodeURIComponent(number)}&txnid=${encodeURIComponent(txnid)}`;

    // --- znajdź miejsce nad "Attached documents" ---
    function findAnchor() {
        const candidates = document.querySelectorAll('h1, h2, h3, h4, b, strong, th, td, legend, div, span, p');
        for (const el of candidates) {
            if (el.children.length === 0 && /attached documents/i.test(el.textContent.trim())) {
                return el;
            }
        }
        return null;
    }

    // --- UI ---
    const wrapper = document.createElement('div');
    wrapper.id = 'tm-shipping-wrapper';
    wrapper.style.cssText = 'margin: 10px 0;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Shipping Table from Auftrag';
    btn.style.cssText = 'padding:6px 12px; cursor:pointer; font-weight:bold; background:#750000; color:#fff; border:none; border-radius:3px;';

    const panel = document.createElement('div');
    panel.id = 'tm-shipping-panel';
    panel.style.cssText = 'display:none; margin-top:10px; padding:10px; border:1px solid #999; background:#fff; overflow:auto; max-height:600px;';

    wrapper.appendChild(btn);
    wrapper.appendChild(panel);

    // --- wstawienie do strony ---
    const anchor = findAnchor();
    if (anchor) {
        const container = anchor.closest('table, fieldset, div') || anchor;
        container.parentNode.insertBefore(wrapper, container);
    } else {
        document.body.insertBefore(wrapper, document.body.firstChild);
        console.warn(`${LOG} Nie znaleziono "Attached documents" - button dodany na górze strony.`);
    }

    // --- logika ---
    let loaded = false;
    let loading = false;

    btn.addEventListener('click', async () => {
        if (loaded) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            return;
        }
        if (loading) return;

        loading = true;
        btn.disabled = true;
        panel.style.display = 'block';
        panel.textContent = 'Ładowanie...';

        try {
            const response = await fetch(auctionUrl, { credentials: 'include' });
            if (!response.ok) throw new Error('HTTP ' + response.status);

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const tables = doc.querySelectorAll('table.shipping-costs-0');

            panel.innerHTML = '';

            if (!tables.length) {
                panel.textContent = 'Nie znaleziono tabeli shipping-costs-0 w Auftragu.';
            } else {
                tables.forEach(t => {
                    const clone = t.cloneNode(true);
                    // usuń podglądy zdjęć (Tip/UnTip nie działają poza oryginalną stroną)
                    clone.querySelectorAll('[onmouseover],[onmouseout]').forEach(el => {
                        el.removeAttribute('onmouseover');
                        el.removeAttribute('onmouseout');
                    });
                    // linki względne -> absolutne
                    clone.querySelectorAll('a[href]').forEach(a => {
                        const href = a.getAttribute('href');
                        if (href && href !== '#') {
                            a.href = new URL(href, 'https://www.prologistics.info/').href;
                        }
                    });
                    panel.appendChild(clone);
                    const clear = document.createElement('div');
                    clear.style.clear = 'both';
                    panel.appendChild(clear);
                });
            }
            loaded = true;
        } catch (err) {
            panel.textContent = 'Błąd pobierania: ' + err.message;
            console.error(`${LOG} Błąd:`, err);
        } finally {
            loading = false;
            btn.disabled = false;
        }
    });
})();

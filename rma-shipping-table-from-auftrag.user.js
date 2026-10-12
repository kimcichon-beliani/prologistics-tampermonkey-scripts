// ==UserScript==
// @name         Prologistics RMA - Shipping Table from Auftrag
// @namespace    kimcichon-beliani
// @version      1.3
// @author       kimrioter
// @description  Dodaje button na stronie RMA, który pobiera tabelę shipping-costs-0 z auction.php (Auftrag, przez ukryty iframe) i wyświetla ją w ticketcie
// @match        https://www.prologistics.info/rma.php*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-shipping-table-from-auftrag.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-shipping-table-from-auftrag.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';
    const TABLE_SELECTOR = 'table.shipping-costs-0';
    const TIMEOUT_MS = 25000;    // maksymalny czas oczekiwania na tabelę
    const POLL_MS = 300;
    const CLICK_AFTER_MS = 2000; // jeśli tabeli nie ma po tym czasie, klikamy "Real shipping prices"

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

    const anchor = findAnchor();
    if (anchor) {
        const container = anchor.closest('table, fieldset, div') || anchor;
        container.parentNode.insertBefore(wrapper, container);
    } else {
        document.body.insertBefore(wrapper, document.body.firstChild);
        console.warn(`${LOG} Nie znaleziono "Attached documents" - button dodany na górze strony.`);
    }

    // --- pobranie tabeli przez ukryty iframe ---
    function fetchTableViaIframe() {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.src = auctionUrl;
            iframe.style.cssText = 'position:fixed; left:-99999px; top:0; width:1400px; height:900px; visibility:hidden;';

            let finished = false;
            let timer = null;
            const startedAt = Date.now();
            let clicked = false;

            const cleanup = () => {
                finished = true;
                clearInterval(timer);
                iframe.remove();
            };

            iframe.addEventListener('load', () => {
                timer = setInterval(() => {
                    if (finished) return;
                    try {
                        const doc = iframe.contentDocument;
                        if (!doc) return;

                        const table = doc.querySelector(TABLE_SELECTOR);
                        if (table && table.querySelector('tbody tr')) {
                            const clone = table.cloneNode(true);
                            cleanup();
                            resolve(clone);
                            return;
                        }

                        // jeśli tabela sama się nie doczytała - kliknij "Real shipping prices"
                        if (!clicked && Date.now() - startedAt > CLICK_AFTER_MS) {
                            const toggle = doc.querySelector('#real_shipping_prices_toggle');
                            if (toggle) {
                                toggle.click();
                                clicked = true;
                            }
                        }

                        if (Date.now() - startedAt > TIMEOUT_MS) {
                            cleanup();
                            reject(new Error('Przekroczono czas oczekiwania na tabelę shipping-costs-0'));
                        }
                    } catch (e) {
                        cleanup();
                        reject(e);
                    }
                }, POLL_MS);
            });

            iframe.addEventListener('error', () => {
                cleanup();
                reject(new Error('Nie udało się załadować Auftragu w iframe'));
            });

            document.body.appendChild(iframe);
        });
    }

    // --- przygotowanie skopiowanej tabeli do wyświetlenia ---
    function prepareTable(clone) {
        // własny styl ukrywania - niezależny od CSS strony
        if (!document.getElementById('tm-shipping-style')) {
            const style = document.createElement('style');
            style.id = 'tm-shipping-style';
            style.textContent = `
                #tm-shipping-panel tr.tm-row-hidden { display: none !important; }
                #tm-shipping-panel tr.tm-row-visible { display: table-row !important; }
            `;
            document.head.appendChild(style);
        }

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
        // sortowanie nie ma tu sensu - wyłącz klikanie nagłówków
        clone.querySelectorAll('a.sort_row').forEach(a => {
            a.removeAttribute('href');
            a.style.cursor = 'default';
        });

        // odtwórz widok z Auftragu: domyślnie tylko "on" bez "toggle", reszta pod "Show all"
        const hiddenRows = [];
        clone.querySelectorAll('tr.cheaper-method').forEach(tr => {
            const visibleByDefault = tr.classList.contains('cheaper-method-on') && !tr.classList.contains('cheaper-method-toggle');

            // usuń klasy strony, żeby jej CSS/JS nie nadpisywał widoczności
            tr.classList.remove('cheaper-method-on', 'cheaper-method-off', 'cheaper-method-toggle');
            tr.style.removeProperty('display');

            if (visibleByDefault) {
                tr.classList.add('tm-row-visible');
            } else {
                tr.classList.add('tm-row-hidden');
                hiddenRows.push(tr);
            }
        });

        return { clone, hiddenRows };
    }

    // --- logika buttona ---
    let loaded = false;
    let loading = false;

    btn.addEventListener('click', async () => {
        // przełączanie widoczności po pierwszym pobraniu
        if (loaded) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            return;
        }
        if (loading) return;

        loading = true;
        btn.disabled = true;
        panel.style.display = 'block';
        panel.textContent = 'Ładowanie Auftragu... (może potrwać kilka sekund)';

        try {
            const rawTable = await fetchTableViaIframe();
            const { clone, hiddenRows } = prepareTable(rawTable);

            panel.innerHTML = '';

            if (hiddenRows.length) {
                const showAllBtn = document.createElement('button');
                showAllBtn.type = 'button';
                showAllBtn.textContent = `Show all (${hiddenRows.length} więcej)`;
                showAllBtn.style.cssText = 'margin-bottom:8px; padding:3px 8px; cursor:pointer;';
                let expanded = false;
                showAllBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    expanded = !expanded;
                    hiddenRows.forEach(tr => {
                        tr.classList.toggle('tm-row-hidden', !expanded);
                        tr.classList.toggle('tm-row-visible', expanded);
                    });
                    showAllBtn.textContent = expanded ? 'Show less' : `Show all (${hiddenRows.length} więcej)`;
                });
                panel.appendChild(showAllBtn);
                panel.appendChild(document.createElement('br'));
            }

            panel.appendChild(clone);
            const clear = document.createElement('div');
            clear.style.clear = 'both';
            panel.appendChild(clear);

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

// ==UserScript==
// @name         Prologistics – RMA Auftrag # Copy Button
// @namespace    kimrioter
// @version      1.0.0
// @description  Dodaje mały przycisk "copy" obok numeru Auftrag w sekcji Auftrag Details na rma.php – kopiuje tylko numer zamówienia (bez " / 3"). Link pozostaje klikalny.
// @author       kimrioter
// @match        https://www.prologistics.info/rma.php*
// @grant        GM_setClipboard
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-auftrag-copy.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-auftrag-copy.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG_PREFIX = '[TM script by kimrioter]';
    const BRAND = '#750000';
    const MARK = 'data-kr-copy-btn'; // znacznik, żeby nie dodawać przycisku dwa razy

    /* ---------- style przycisku ---------- */
    const style = document.createElement('style');
    style.textContent = `
        .kr-copy-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 6px;
            padding: 0 5px;
            height: 16px;
            min-width: 22px;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            font-weight: bold;
            line-height: 1;
            color: #fff;
            background: ${BRAND};
            border: 1px solid ${BRAND};
            border-radius: 3px;
            cursor: pointer;
            vertical-align: middle;
            transition: background .15s ease, color .15s ease;
            user-select: none;
        }
        .kr-copy-btn:hover { background: #a00000; border-color: #a00000; }
        .kr-copy-btn.kr-copied { background: #2e7d32; border-color: #2e7d32; }
    `;
    document.head.appendChild(style);

    /* ---------- pomocnicze ---------- */

    // wyciąga sam numer zamówienia: "15333852 / 3" -> "15333852"
    function extractAuftragNumber(text) {
        if (!text) return null;
        const cleaned = text.replace(/\u00a0/g, ' ').trim();
        const firstPart = cleaned.split('/')[0].trim();
        const match = firstPart.match(/\d+/);
        return match ? match[0] : null;
    }

    // kopiowanie do schowka (z fallbackiem dla starszych/nie-HTTPS kontekstów)
    function copyToClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            return Promise.resolve();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy') ? resolve() : reject();
            } catch (e) {
                reject(e);
            } finally {
                ta.remove();
            }
        });
    }

    function buildButton(getNumber) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kr-copy-btn';
        btn.textContent = 'copy';
        btn.title = 'Kopiuj numer Auftrag (bez pozycji)';

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation(); // żeby nie odpalić linku obok
            const number = getNumber();
            if (!number) {
                console.warn(LOG_PREFIX, 'Nie udało się odczytać numeru Auftrag.');
                return;
            }
            copyToClipboard(number).then(() => {
                console.log(LOG_PREFIX, 'Skopiowano:', number);
                btn.textContent = '✓';
                btn.classList.add('kr-copied');
                setTimeout(() => {
                    btn.textContent = 'copy';
                    btn.classList.remove('kr-copied');
                }, 1200);
            }).catch(err => {
                console.error(LOG_PREFIX, 'Błąd kopiowania:', err);
            });
        });

        return btn;
    }

    /* ---------- główna logika ---------- */

    function processPage() {
        const cells = document.querySelectorAll('td, th');

        cells.forEach(labelCell => {
            const label = labelCell.textContent.replace(/\u00a0/g, ' ').trim();
            if (label !== 'Auftrag #' && label !== 'Auftrag#') return;

            // komórka z wartością – zwykle sąsiednia; jeśli nie ma, sprawdzamy tę samą
            let valueCell = labelCell.nextElementSibling;
            if (!valueCell || !extractAuftragNumber(valueCell.textContent)) {
                valueCell = labelCell.querySelector('a') ? labelCell : valueCell;
            }
            if (!valueCell) return;
            if (valueCell.hasAttribute(MARK)) return; // już obsłużone

            const link = valueCell.querySelector('a');
            const sourceEl = link || valueCell;
            const number = extractAuftragNumber(sourceEl.textContent);
            if (!number) return;

            const btn = buildButton(() => extractAuftragNumber(sourceEl.textContent));

            // wstawiamy przycisk zaraz za linkiem – link zostaje w pełni klikalny
            if (link && link.parentNode) {
                link.insertAdjacentElement('afterend', btn);
            } else {
                valueCell.appendChild(btn);
            }

            valueCell.setAttribute(MARK, '1');
            console.log(LOG_PREFIX, 'Dodano przycisk copy dla Auftrag:', number);
        });
    }

    processPage();

    // strona może doładowywać treść dynamicznie – obserwujemy zmiany DOM
    let timer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(processPage, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();

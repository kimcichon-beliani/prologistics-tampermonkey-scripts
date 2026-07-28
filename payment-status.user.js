// ==UserScript==
// @name         Status płatności — Payments
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Dopisuje status ("Unpaid order" / "Order paid in full" / "Overpayment") obok kwoty w tabelce Payments
// @author       kimrioter
// @match        https://www.prologistics.info/auction.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM payment status script by kimrioter] Start');

    function findTargetCell() {
        const boldEls = document.querySelectorAll('td[align="right"] b');
        for (const b of boldEls) {
            if (b.textContent.trim() === 'Auftrag value - Total of Payments') {
                return b.closest('td');
            }
        }
        return null;
    }

    function findRowByBoldText(exactText) {
        const boldEls = document.querySelectorAll('td b');
        for (const b of boldEls) {
            if (b.textContent.trim() === exactText) return b.closest('tr');
        }
        return null;
    }

    let columnBuilt = false;
    let messageCell = null;

    function buildRealColumn(targetTd, totalRow) {
        if (columnBuilt) return;

        const targetRow = targetTd.closest('tr');
        if (!targetRow) return;

        const style = document.createElement('style');
        style.textContent = `
            .tm-payment-status-value {
                text-align: center;
                font-weight: bold;
                vertical-align: middle;
            }
        `;
        document.head.appendChild(style);

        // Wykorzystujemy istniejącą, pustą kolumnę (tę samą, w której w wierszach z płatnościami
        // widnieje "Unbook") — nie dodajemy żadnej nowej kolumny ani nagłówka "Status".
        // Zmniejszamy colspan istniejących komórek podsumowania o 1, żeby zrobić na nią miejsce.
        if (targetTd.colSpan > 1) {
            targetTd.colSpan = targetTd.colSpan - 1;
        }

        const valueTd = document.createElement('td');
        valueTd.className = 'tm-payment-status-value';

        if (totalRow) {
            const totalCell = totalRow.querySelector('td[colspan]');
            if (totalCell && totalCell.colSpan > 1) {
                totalCell.colSpan = totalCell.colSpan - 1;
            }
            valueTd.rowSpan = 2;
            totalRow.appendChild(valueTd);
        } else {
            // brak wiersza "Total of Payments" (np. inny układ strony) — wstawiamy tylko w wierszu Auftrag value
            targetRow.appendChild(valueTd);
        }

        messageCell = valueTd;
        columnBuilt = true;
    }

    function updatePaymentStatus() {
        const targetTd = findTargetCell();
        if (!targetTd) return;

        const amountSpan = targetTd.querySelector('span');
        if (!amountSpan) return;

        // Wyciągamy samą liczbę, niezależnie od symbolu/kodu waluty (€, Lei, PLN, zł itd.)
        // oraz niezależnie od tego, gdzie dokładnie stoi znak minus względem waluty
        const rawText = amountSpan.textContent.trim();
        const digitsMatch = rawText.match(/\d[\d.,]*\d|\d/);
        if (!digitsMatch) return;

        const isNegative = /^[^\d]*-/.test(rawText);
        const numStr = digitsMatch[0].replace(/,/g, '');
        const value = parseFloat(numStr) * (isNegative ? -1 : 1);
        if (isNaN(value)) return;

        let message = '';
        let color = '';
        if (value > 0) {
            message = 'Unpaid order';
            color = '#d32f2f';
        } else if (value === 0) {
            message = 'Order paid in full';
            color = '#2e7d32';
        } else {
            message = 'Overpayment';
            color = '#ef6c00';
        }

        const totalRow = findRowByBoldText('Total of Payments');
        buildRealColumn(targetTd, totalRow);
        if (!messageCell) return;

        if (messageCell.textContent !== message) {
            messageCell.textContent = message;
        }
        messageCell.style.color = color;
    }

    updatePaymentStatus();

    // Odświeżamy status, gdyby kwota zmieniła się dynamicznie (np. po dodaniu płatności bez przeładowania strony)
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updatePaymentStatus, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    console.log('[TM payment status script by kimrioter] Zainicjalizowano observer');
})();

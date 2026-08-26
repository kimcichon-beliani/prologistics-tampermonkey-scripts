// ==UserScript==
// @name         BricoBravo SellerHub – kolorowanie zamówień + "Added to prolo?"
// @namespace    kimrioter
// @version      1.4.0
// @description  Stopniowana czerwień dla zaległych zamówień, zieleń dla zakończonych, zapamiętywany checkbox "Added to prolo?" – lista /orders
// @author       kimrioter
// @match        https://sellerhub.bricobravo.com/orders*
// @homepageURL  https://github.com/kimcichon-beliani/bricobravo-sellerhub-scripts
// @supportURL   https://github.com/kimcichon-beliani/bricobravo-sellerhub-scripts/issues
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/bricobravo-sellerhub-scripts/main/bricobravo-orders-highlighter.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/bricobravo-sellerhub-scripts/main/bricobravo-orders-highlighter.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[TM script by kimrioter]';

    /* ====================== KONFIGURACJA ====================== */
    // Po ilu dniach zamówienie ma się podświetlić na czerwono.
    // 2 = zamówienie z 18/08 podświetli się 20/08.
    const PROG_DNI = 2;

    // true  -> na czerwono tylko zamówienia w statusie "Da spedire" (do wysyłki)
    // false -> na czerwono każde zamówienie starsze niż PROG_DNI
    const TYLKO_DO_WYSYLKI = true;

    // Delikatna zieleń dla zamówień w statusie "Completato".
    const ZIELONE_COMPLETATO = true;

    // true -> zaznaczenie "Added to prolo?" gasi czerwień; wiersz wraca do
    // zwykłego wyglądu, a na zielono zrobi się dopiero przy statusie "Completato"
    const ZAZNACZONE_BEZ_CZERWIENI = true;

    // Nagłówek kolumny z checkboxem – każdy element to osobna linijka
    const NAGLOWEK_CHECKBOX = ['ADDED', 'TO PROLO?'];

    // Klucz w localStorage
    const STORAGE_KEY = 'tm_brico_added_to_prolo';
    /* ========================================================== */

    const RE_DATA = /(\d{2})\/(\d{2})\/(\d{4})/;
    const RE_NR = /BB\d+-F\d+/i;

    // Poziomy czerwieni: im starsze zamówienie, tym ciemniej.
    // Indeks = liczba dni ponad PROG_DNI (0 = dokładnie na progu).
    const POZIOMY = [
        { tlo: 'rgba(239, 68, 68, 0.08)', kreska: 'rgba(220, 38, 38, 0.45)' },
        { tlo: 'rgba(239, 68, 68, 0.14)', kreska: 'rgba(220, 38, 38, 0.60)' },
        { tlo: 'rgba(235, 55, 55, 0.20)', kreska: 'rgba(200, 30, 30, 0.72)' },
        { tlo: 'rgba(230, 45, 45, 0.27)', kreska: 'rgba(190, 25, 25, 0.82)' },
        { tlo: 'rgba(225, 38, 38, 0.35)', kreska: 'rgba(175, 20, 20, 0.90)' },
        { tlo: 'rgba(220, 30, 30, 0.44)', kreska: 'rgba(160, 15, 15, 1)' },
    ];

    const KLASA_OK = 'tm-zamowienie-zakonczone';
    const KLASA_KOM = 'tm-prolo-cell';

    /* ------------------------- STYLE ------------------------- */
    // !important, bo React nadpisuje style inline
    const reguly = POZIOMY.map((p, i) => `
        tr.tm-stare-${i} > td {
            background-color: ${p.tlo} !important;
        }
        tr.tm-stare-${i} > td:first-child {
            box-shadow: inset 3px 0 0 0 ${p.kreska} !important;
        }
    `).join('\n');

    const css = document.createElement('style');
    css.textContent = `
        ${reguly}
        tr.${KLASA_OK} > td {
            background-color: rgba(34, 197, 94, 0.09) !important;
        }
        tr.${KLASA_OK} > td:first-child {
            box-shadow: inset 3px 0 0 0 rgba(22, 163, 74, 0.45) !important;
        }
        td.${KLASA_KOM}, th.${KLASA_KOM} {
            text-align: center !important;
        }
        th.${KLASA_KOM} {
            white-space: normal !important;
            line-height: 1.25;
        }
        td.${KLASA_KOM} input[type="checkbox"] {
            width: 17px;
            height: 17px;
            cursor: pointer;
            accent-color: #16a34a;
            vertical-align: middle;
        }
    `;
    document.head.appendChild(css);

    /* ---------------------- PAMIĘĆ (localStorage) ---------------------- */
    function wczytajStan() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch (e) {
            console.warn(`${LOG} nie udało się odczytać zapisanych zaznaczeń`, e);
            return {};
        }
    }

    function zapiszStan(stan) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stan));
        } catch (e) {
            console.warn(`${LOG} nie udało się zapisać zaznaczenia`, e);
        }
    }

    let stan = wczytajStan();

    function ustawZaznaczenie(nrZamowienia, zaznaczone) {
        stan = wczytajStan(); // odświeżenie, gdyby otwarte były dwie karty
        if (zaznaczone) {
            stan[nrZamowienia] = new Date().toISOString();
        } else {
            delete stan[nrZamowienia];
        }
        zapiszStan(stan);
    }

    /* ------------------------- DATY ------------------------- */
    function dzisiajOPolnocy() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // "26/08/2026, 10:02" -> Date (bez godziny)
    function parsujDate(tekst) {
        const m = RE_DATA.exec(tekst);
        if (!m) return null;
        const [, dzien, miesiac, rok] = m;
        const d = new Date(Number(rok), Number(miesiac) - 1, Number(dzien));
        d.setHours(0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }

    function roznicaWDniach(data, dzis) {
        return Math.round((dzis - data) / 86400000);
    }

    /* ------------------------- TABELA ------------------------- */
    function dodajNaglowek() {
        const wierszNaglowka = document.querySelector('thead tr');
        if (!wierszNaglowka || wierszNaglowka.querySelector(`.${KLASA_KOM}`)) return;

        const komorki = wierszNaglowka.querySelectorAll('th');
        if (!komorki.length) return;

        const th = document.createElement('th');
        th.className = `${komorki[komorki.length - 1].className} ${KLASA_KOM}`.trim();
        NAGLOWEK_CHECKBOX.forEach((linia, i) => {
            if (i > 0) th.appendChild(document.createElement('br'));
            th.appendChild(document.createTextNode(linia));
        });
        wierszNaglowka.appendChild(th);
    }

    function dodajCheckbox(tr, nrZamowienia) {
        let td = tr.querySelector(`.${KLASA_KOM}`);
        if (!td) {
            const komorki = tr.querySelectorAll('td');
            td = document.createElement('td');
            td.className = `${komorki[komorki.length - 1].className} ${KLASA_KOM}`.trim();

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.title = 'Dodane do prologistics';
            input.addEventListener('change', (e) => {
                e.stopPropagation();
                const nr = td.dataset.nr;
                ustawZaznaczenie(nr, input.checked);
                console.log(`${LOG} ${nr} -> added to prolo: ${input.checked}`);
                odswiezZOpoznieniem();
            });
            // klik w komórkę nie ma otwierać zamówienia
            td.addEventListener('click', (e) => e.stopPropagation());

            td.appendChild(input);
            tr.appendChild(td);
        }

        td.dataset.nr = nrZamowienia;
        const input = td.querySelector('input');
        const zapisane = !!stan[nrZamowienia];
        if (input.checked !== zapisane) input.checked = zapisane;

        return zapisane;
    }

    function przetworzWiersz(tr, dzis) {
        const komorki = Array.from(tr.querySelectorAll('td'));
        if (!komorki.length) return false;

        // Szukamy komórki z datą (nie polegamy na numerze kolumny)
        let dataZamowienia = null;
        for (const td of komorki) {
            const d = parsujDate(td.textContent.trim());
            if (d) { dataZamowienia = d; break; }
        }
        if (!dataZamowienia) return false;

        const dopasowanieNr = RE_NR.exec(tr.textContent);
        const nrZamowienia = dopasowanieNr
            ? dopasowanieNr[0].toUpperCase()
            : komorki[0].textContent.trim();

        const zrobioneWProlo = dodajCheckbox(tr, nrZamowienia);

        const wiek = roznicaWDniach(dataZamowienia, dzis);
        const tekstWiersza = tr.textContent.toLowerCase();
        const doWysylki = tekstWiersza.includes('da spedire');
        const zakonczone = tekstWiersza.includes('completato');

        let czerwone = wiek >= PROG_DNI && (!TYLKO_DO_WYSYLKI || doWysylki);
        if (ZAZNACZONE_BEZ_CZERWIENI && zrobioneWProlo) czerwone = false;

        // Poziom nasycenia: im starsze, tym ciemniej (do ostatniego poziomu)
        const poziom = czerwone
            ? Math.min(wiek - PROG_DNI, POZIOMY.length - 1)
            : -1;

        POZIOMY.forEach((_, i) => tr.classList.toggle(`tm-stare-${i}`, i === poziom));
        tr.classList.toggle(KLASA_OK, ZIELONE_COMPLETATO && zakonczone && !czerwone);

        if (czerwone) {
            tr.title = `Zamówienie sprzed ${wiek} dni`;
        } else if (tr.title.startsWith('Zamówienie sprzed')) {
            tr.removeAttribute('title');
        }

        return czerwone;
    }

    function odswiez() {
        const wiersze = document.querySelectorAll('tbody tr');
        if (!wiersze.length) return;

        // Sami zmieniamy DOM (dokładamy kolumnę) – pauzujemy obserwatora
        obserwator.disconnect();
        try {
            stan = wczytajStan();
            dodajNaglowek();

            const dzis = dzisiajOPolnocy();
            let podswietlone = 0;
            wiersze.forEach((tr) => { if (przetworzWiersz(tr, dzis)) podswietlone++; });

            if (podswietlone !== ostatniaLiczba) {
                ostatniaLiczba = podswietlone;
                console.log(`${LOG} podświetlono ${podswietlone} zamówień starszych niż ${PROG_DNI} dni`);
            }
        } finally {
            wlaczObserwatora();
        }
    }

    let ostatniaLiczba = -1;
    let timer = null;
    function odswiezZOpoznieniem() {
        clearTimeout(timer);
        timer = setTimeout(odswiez, 150);
    }

    // Tabela jest renderowana dynamicznie (React) – obserwujemy zmiany w DOM.
    // attributes: false, żeby własne zmiany klas nie wywoływały pętli.
    const obserwator = new MutationObserver(odswiezZOpoznieniem);
    function wlaczObserwatora() {
        obserwator.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
        });
    }

    wlaczObserwatora();
    window.addEventListener('focus', odswiezZOpoznieniem);
    odswiezZOpoznieniem();
})();

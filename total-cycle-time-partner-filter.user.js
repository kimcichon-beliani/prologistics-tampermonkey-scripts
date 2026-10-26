// ==UserScript==
// @name         Total Cycle Time – szybki filtr partnera
// @namespace    kimrioter
// @version      1.0.0
// @description  Wpisujesz partnera, skrypt zaznacza go oraz odpowiadającego mu Sellera w filtrach total_cycle_time.php
// @author       kimrioter
// @match        https://www.prologistics.info/total_cycle_time.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/total-cycle-time-partner-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/total-cycle-time-partner-filter.user.js
// ==/UserScript==

(function () {
  'use strict';

  const LOG = '[TM script by kimrioter]';
  const BRAND = '#750000';

  // ───────────────────────────────────────────────────────────────
  // KONFIGURACJA SELLERÓW
  // Klucz = kraj (ostatni człon nazwy partnera, np. "Kaufland AT" -> "AT").
  // Wartość = lista możliwych nazw Sellera w tabelce (pierwsza znaleziona wygrywa).
  // UZUPEŁNIJ pozostałe kraje według listy "Sellerzy z których korzystamy".
  // ───────────────────────────────────────────────────────────────
  const SELLER_BY_COUNTRY = {
    AT: ['Beliani (DE) GmbH', 'Beliani AT'],
    // DE: ['Beliani (DE) GmbH'],
    // PL: ['...'],
  };

  // Wyjątki dla konkretnych partnerów (mają pierwszeństwo przed krajem)
  const SELLER_BY_PARTNER = {
    // 'Galaxus CH': ['...'],
  };

  const PARTNERS = [
    'Allegro Brand PL', 'Allegro CZ', 'Allegro HU', 'Allegro PL', 'Allegro SK', 'Altex RO',
    'Amazon + Prime DE', 'Amazon + Prime ES', 'Amazon + Prime FR', 'Amazon IT', 'Amazon NL',
    'Amazon PL', 'Amazon SE', 'Amazon Seller Flex DE', 'Amazon UK', 'B&Q UK', 'Bauhaus DE',
    'Black Red White PL', 'Bloop PT', 'Bol.com NL', 'Brico BE', 'Brico Bravo IT',
    'Brico Depot ES', 'Brico Depot PT', 'Bricomarché FR', 'BUT FR', 'Carrefour ES',
    'Carrefour FR', 'Castorama FR', 'Castorama PL', 'Cdiscount FR', 'Check24 DE',
    'Conforama ES', 'Conforama FR', 'Conforama PT', 'Cultura FR', 'E-price IT', 'eBay DE',
    'eBay FR', 'eBay IT', 'eBay UK', 'eMAG HU', 'eMAG RO', 'Empik PL', 'Furniture1 HU',
    'Furniture1 LT', 'Galaxus CH', 'Gamm Vert FR', 'Hobbybox DK', 'Hobbybox FI',
    'Hobbybox SE', 'Home&You PL', 'Home24 AT', 'Home24 CH', 'Home24 DE', 'Home24 FR',
    'Home24 NL', 'Homedeco NL', 'Hornbach DE', 'Joybuy DE', 'Kaufland AT', 'Kaufland CZ',
    'Kaufland DE', 'Kaufland PL', 'Kaufland SK', 'Kuanto Kusta PT', 'Leen Bakker BE',
    'Leen Bakker NL', 'Leroy Merlin ES', 'Leroy Merlin FR', 'Leroy Merlin IT',
    'Leroy Merlin PT', 'Leroy Merlin RO', 'Limango DE', 'Maisons du Monde DE',
    'Maisons du Monde ES', 'Maisons du Monde FR', 'Maisons du Monde IT', 'ManoMano DE',
    'ManoMano ES', 'ManoMano FR', 'ManoMano IT', 'ManoMano UK', 'Manor CH',
    'MediaMarkt Saturn CH', 'Mömax AT', 'Mömax DE', 'Morele PL', 'OBI CH', 'OBI DE',
    'OnBuy UK', 'PayBack DE', 'Praxis NL', 'Robert Dyas UK', 'Shein DE', 'Shopping AT',
    'Temu CH', 'Trademax Dropship SE', 'Trademax OnDemand SE', 'Vente Unique AT',
    'Vente Unique BE', 'Vente Unique CH', 'Vente Unique DE', 'Vente Unique ES',
    'Vente Unique FR', 'Vente Unique IT', 'Vente Unique LU', 'Vente Unique NL',
    'Vente Unique PL', 'Vente Unique PT', 'Vente Unique SE', 'Vente Unique UK',
    'Vivre HU', 'Vivre RO', 'Wayfair UK', 'Wolf DE', 'Worten PT', 'XXXLutz AT',
    'XXXLutz CH', 'XXXLutz CZ', 'XXXLutz DE', 'XXXLutz HR', 'XXXLutz RO', 'XXXLutz SE',
    'XXXLutz SI',
  ];

  // ───────────────────────────────────────────────────────────────
  // Pomocnicze
  // ───────────────────────────────────────────────────────────────
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Zmiany zrobione przez skrypt – żeby można je było cofnąć przy kolejnym filtrowaniu
  let changes = [];

  function fireChange(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) {
      try { window.jQuery(el).trigger('change'); } catch (e) { /* ignoruj */ }
    }
  }

  function checkboxLabelText(input) {
    if (input.labels && input.labels.length) return input.labels[0].textContent;
    const parent = input.parentElement;
    if (parent && parent.tagName === 'LABEL') return parent.textContent;
    // układ tabelkowy: [checkbox] [nazwa] w sąsiednich komórkach
    const td = input.closest('td');
    if (td && td.nextElementSibling) return td.nextElementSibling.textContent;
    if (input.nextSibling && input.nextSibling.textContent.trim()) return input.nextSibling.textContent;
    return parent ? parent.textContent : '';
  }

  // Zaznacza pozycję o dokładnie takim tekście (option / checkbox / radio)
  function selectByText(candidates) {
    const wanted = candidates.map(norm);
    let hits = 0;

    document.querySelectorAll('option').forEach((opt) => {
      if (!wanted.includes(norm(opt.textContent))) return;
      const sel = opt.closest('select');
      if (!sel || opt.selected) return;
      changes.push({ type: 'option', el: opt, sel, prevSelected: false });
      opt.selected = true;
      fireChange(sel);
      hits++;
    });

    document.querySelectorAll('input[type=checkbox], input[type=radio]').forEach((inp) => {
      if (!wanted.includes(norm(checkboxLabelText(inp)))) return;
      if (inp.checked) return;
      changes.push({ type: 'check', el: inp });
      inp.click();
      hits++;
    });

    return hits;
  }

  function undoChanges() {
    changes.reverse().forEach((c) => {
      if (c.type === 'option') {
        c.el.selected = c.prevSelected;
        fireChange(c.sel);
      } else if (c.type === 'check' && c.el.checked) {
        c.el.click();
      }
    });
    changes = [];
  }

  function sellersFor(partner) {
    if (SELLER_BY_PARTNER[partner]) return SELLER_BY_PARTNER[partner];
    const country = partner.trim().split(' ').pop();
    return SELLER_BY_COUNTRY[country] || null;
  }

  // ───────────────────────────────────────────────────────────────
  // Akcja główna
  // ───────────────────────────────────────────────────────────────
  function applyFilter(partner, setStatus) {
    undoChanges();

    const partnerHits = selectByText([partner]);
    const sellers = sellersFor(partner);
    let sellerHits = 0;
    if (sellers) sellerHits = selectByText(sellers);

    console.log(LOG, 'filtr', { partner, partnerHits, sellers, sellerHits });

    const msg = [];
    msg.push(partnerHits ? `✔ partner: ${partner}` : `✖ nie znaleziono partnera „${partner}”`);
    if (!sellers) msg.push('⚠ brak zdefiniowanego Sellera dla tego kraju');
    else msg.push(sellerHits ? `✔ seller: ${sellers[0]}` : `✖ nie znaleziono Sellera (${sellers.join(' / ')})`);
    setStatus(msg.join('\n'));
  }

  // ───────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────
  function buildPanel() {
    if (document.getElementById('tm-partner-filter')) return;

    const box = document.createElement('div');
    box.id = 'tm-partner-filter';
    box.style.cssText = [
      'position:fixed', 'top:80px', 'right:12px', 'z-index:99999', 'width:260px',
      'background:#fff', `border:2px solid ${BRAND}`, 'border-radius:6px',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)', 'font:13px Arial,sans-serif', 'padding:8px',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Filtr partnera';
    title.style.cssText = `font-weight:bold;color:${BRAND};margin-bottom:6px;cursor:pointer`;

    const body = document.createElement('div');

    const input = document.createElement('input');
    input.setAttribute('list', 'tm-partner-list');
    input.placeholder = 'np. Kaufland AT';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:4px;margin-bottom:6px';

    const dl = document.createElement('datalist');
    dl.id = 'tm-partner-list';
    PARTNERS.forEach((p) => {
      const o = document.createElement('option');
      o.value = p;
      dl.appendChild(o);
    });

    const btnStyle = `background:${BRAND};color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer;margin-right:6px`;
    const apply = document.createElement('button');
    apply.textContent = 'Zastosuj';
    apply.style.cssText = btnStyle;
    const clear = document.createElement('button');
    clear.textContent = 'Wyczyść';
    clear.style.cssText = btnStyle;

    const status = document.createElement('pre');
    status.style.cssText = 'margin:8px 0 0;white-space:pre-wrap;font:12px Arial,sans-serif';
    const setStatus = (t) => { status.textContent = t; };

    const run = () => {
      const val = input.value.trim();
      const match = PARTNERS.find((p) => norm(p) === norm(val));
      if (!match) return setStatus('✖ wybierz partnera z listy podpowiedzi');
      applyFilter(match, setStatus);
    };

    apply.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    clear.addEventListener('click', () => { undoChanges(); input.value = ''; setStatus('Wyczyszczono zaznaczenia ze skryptu'); });
    title.addEventListener('click', () => { body.style.display = body.style.display === 'none' ? '' : 'none'; });

    body.append(input, dl, apply, clear, status);
    box.append(title, body);
    document.body.appendChild(box);
  }

  buildPanel();
  console.log(LOG, 'total-cycle-time-partner-filter załadowany');
})();

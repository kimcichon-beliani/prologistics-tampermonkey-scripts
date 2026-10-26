// ==UserScript==
// @name         Total Cycle Time – quick partner filter
// @namespace    kimrioter
// @version      1.2.0
// @description  Pick a partner in the panel and the script fills in Seller and Source Seller on total_cycle_time.php
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
  // PARTNER -> nazwy w liście "Source Seller" (dokładny tekst opcji).
  // Seller (górna lista) jest wyliczany automatycznie z klasy opcji Source Seller
  // (np. Allegro CZ ma class="Beliani CZ" -> zaznaczy się "CZ: Beliani CZ = ...").
  // ───────────────────────────────────────────────────────────────
  const PARTNERS = {
    'Allegro Brand PL': ['Allegro Brand'],
    'Allegro CZ': ['Allegro CZ'],
    'Allegro HU': ['Allegro HU'],
    'Allegro PL': ['Allegro'],
    'Allegro SK': ['Allegro SK'],
    'Altex RO': ['Altex RO'],
    'Amazon + Prime DE': ['Amazon DE', 'Amazon Prime DE'],
    'Amazon + Prime ES': ['Amazon ES', 'Amazon Prime ES'],
    'Amazon + Prime FR': ['Amazon FR', 'Amazon Prime FR'],
    'Amazon IT': ['Amazon IT'],
    'Amazon NL': ['Amazon NL'],
    'Amazon PL': ['Amazon PL'],
    'Amazon SE': ['Amazon SE'],
    'Amazon Seller Flex DE': ['Amazon DE Seller Flex'],
    'Amazon UK': ['Amazon UK'],
    'B&Q UK': ['B&Q', 'B&Q 0 VAT'],
    'Bauhaus DE': ['Bauhaus DE'],
    'Black Red White PL': ['Black Red White'],
    'Bloop PT': ['Bloop PT'],
    'Bol.com NL': ['Bol.com NL'],
    'Brico BE': ['Brico BE'],
    'Brico Bravo IT': ['Brico Bravo IT'],
    'Brico Depot ES': ['Brico Depot ES'],
    'Brico Depot PT': ['Brico Depot PT'],
    'Bricomarché FR': ['Bricomarche FR'],
    'BUT FR': ['BUT'],
    'Carrefour ES': ['Carrefour ES'],
    'Carrefour FR': ['Carrefour FR'],
    'Castorama FR': ['Castorama FR'],
    'Castorama PL': ['Castorama PL'],
    'Cdiscount FR': ['CDiscount FR'],
    'Check24 DE': ['Check24'],
    'Conforama ES': ['Conforama ES'],
    'Conforama FR': ['Conforama'],
    'Conforama PT': ['CONFORAMA_PRT'],
    'Cultura FR': ['Cultura FR'],
    'E-price IT': ['ePrice IT'],
    'eBay DE': ['eBay DE'],
    'eBay FR': ['Ebay FR'],
    'eBay IT': ['eBay IT'],
    'eBay UK': ['eBay UK'],
    'eMAG HU': ['EMAG HU', 'EMAG HU COD'],
    'eMAG RO': ['eMAG RO'],
    'Empik PL': ['Empik'],
    'Furniture1 HU': ['Furniture1 HU'],
    'Furniture1 LT': ['Furniture1'],
    'Galaxus CH': ['Galaxus (Beliani) CH'],
    'Gamm Vert FR': ['Gamm vert FR'],
    'Hobbybox DK': ['Hobbybox DK'],
    'Hobbybox FI': ['Hobbybox FI'],
    'Hobbybox SE': ['Hobbybox SE'],
    'Home&You PL': ['Home&You'],
    'Home24 AT': ['Home24 AT'],
    'Home24 CH': ['Home24 CH'],
    'Home24 DE': ['Home24 DE'],
    'Home24 FR': ['Home24 FR'],
    'Home24 NL': ['Home24 NL'],
    'Homedeco NL': ['Homedeco NL'],
    'Hornbach DE': ['Hornbach DE'],
    'Joybuy DE': ['Joybuy DE'],
    'Kaufland AT': ['Kaufland AT'],
    'Kaufland CZ': ['Kaufland CZ'],
    'Kaufland DE': ['Kaufland DE'],
    'Kaufland PL': ['Kaufland PL'],
    'Kaufland SK': ['Kaufland SK'],
    'Kuanto Kusta PT': ['KuantoKusta PT'],
    'Leen Bakker BE': ['Leen Bakker BE'],
    'Leen Bakker NL': ['Leen Bakker NL'],
    'Leroy Merlin ES': ['LEROYMERLIN_ESP'],
    'Leroy Merlin FR': ['LEROYMERLIN'],
    'Leroy Merlin IT': ['Leroy Merlin IT'],
    'Leroy Merlin PT': ['Leroy Merlin PT'],
    'Leroy Merlin RO': ['Leroy Merlin RO'],
    'Limango DE': ['Limango DE'],
    'Maisons du Monde DE': ['MAISONDUMONDE_DEU'],
    'Maisons du Monde ES': ['Maisons du Monde ES'],
    'Maisons du Monde FR': ['MAISONDUMONDE'],
    'Maisons du Monde IT': ['Maisons du Monde IT'],
    'ManoMano DE': ['Manomano (DE)'],
    'ManoMano ES': ['Mano Mano ES / MonEchelle'],
    'ManoMano FR': ['Mano Mano FR'],
    'ManoMano IT': ['ManoMano IT'],
    'ManoMano UK': ['Manomano (UK)'],
    'Manor CH': ['MANOR'],
    'MediaMarkt Saturn CH': ['MediaMarkt Saturn CH'],
    'Mömax AT': ['Mömax AT'],
    'Mömax DE': ['Mömax DE'],
    'Morele PL': ['Morele'],
    'OBI CH': ['OBI CH'],
    'OBI DE': ['OBI DE'],
    'OnBuy UK': ['OnBuy'],
    'PayBack DE': ['Payback DE'],
    'Praxis NL': ['Praxis NL'],
    'Robert Dyas UK': ['Robert Dyas'],
    'Shein DE': ['Shein DE'],
    'Shopping AT': ['Shöpping AT'],
    'Temu CH': ['TEMU CH'],
    'Trademax Dropship SE': ['Trademax SE'],
    'Trademax OnDemand SE': ['Trademax SE'],
    'Vente Unique AT': ['Vente Unique Austria'],
    'Vente Unique BE': ['Vente Unique Belgium'],
    'Vente Unique CH': ['Vente Unique CH'],
    'Vente Unique DE': ['VENTEUNIQUE_DEU'],
    'Vente Unique ES': ['Vente-Unique ES'],
    'Vente Unique FR': ['Vente Unique'],
    'Vente Unique IT': ['Vente Unique IT'],
    'Vente Unique LU': ['Vente Unique Luxembourg'],
    'Vente Unique NL': ['Vente-Unique NL'],
    'Vente Unique PL': ['Vente Unique PL'],
    'Vente Unique PT': ['Vente-Unique PT'],
    'Vente Unique SE': ['Vente Unique SE'],
    'Vente Unique UK': ['Vente Unique UK', 'Vente Unique UK 0% VAT'],
    'Vivre HU': ['Vivre HU'],
    'Vivre RO': ['Vivre RO'],
    'Wayfair UK': ['Wayfair UK (20%)'],
    'Wolf DE': ['Supply 24 (Wolf)'],
    'Worten PT': ['Worten Marketplace'],
    'XXXLutz AT': ['XXXLutz AT'],
    'XXXLutz CH': ['XXXLutz CH'],
    'XXXLutz CZ': ['XXXLutz CZ'],
    'XXXLutz DE': ['XXXLutz'],
    'XXXLutz HR': ['XXXLutz HR'],
    'XXXLutz RO': ['XXXLutz RO'],
    'XXXLutz SE': ['XXXLutz SE'],
    'XXXLutz SI': ['XXXLutz SI'],
  };

  // Sellerzy, z których NIE korzystamy (wartości `value` z listy Seller) – zostaną pominięci
  const BLOCKED_SELLERS = [
    'BCE',
    'Beliani (International) GmbH',
    'Beliani DE alternative',
    'Beliani SP Alternative Seller',
    'Beliani PL Alternative',
    'Beliani PL Alternative Liquida',
  ];

  // ───────────────────────────────────────────────────────────────
  // Pomocnicze
  // ───────────────────────────────────────────────────────────────
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function fireChange(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true })); // odpala też inline onchange="chooseSourceSeller()"
  }

  function deselectAll(select) {
    Array.from(select.options).forEach((o) => { o.selected = false; });
  }

  function applyPartner(partner, setStatus) {
    const sellerSel = document.getElementById('seller');
    const sourceSel = document.getElementById('source_seller');
    if (!sellerSel || !sourceSel) return setStatus('✖ Seller / Source Seller lists not found');

    const wantedNames = (PARTNERS[partner] || []).map(norm);
    const sourceOpts = Array.from(sourceSel.options).filter((o) => wantedNames.includes(norm(o.textContent)));
    if (!sourceOpts.length) return setStatus(`✖ "${partner}" not found in the Source Seller list`);

    // Seller wyliczony z klasy opcji Source Seller
    const skipped = [];
    const okSourceOpts = [];
    const sellerValues = new Set();
    sourceOpts.forEach((o) => {
      const cls = (o.className || '').trim();
      const sellerOpt = Array.from(sellerSel.options).find((s) => s.value === cls);
      if (!cls || !sellerOpt) { skipped.push(`${o.textContent.trim()} (no seller)`); return; }
      if (BLOCKED_SELLERS.includes(cls)) { skipped.push(`${o.textContent.trim()} (seller ${cls} skipped)`); return; }
      sellerValues.add(cls);
      okSourceOpts.push(o);
    });

    if (!okSourceOpts.length) return setStatus('✖ none of the sellers is allowed:\n' + skipped.join('\n'));

    // 1) Seller – odpala chooseSourceSeller(), które przefiltruje Source Seller
    deselectAll(sellerSel);
    Array.from(sellerSel.options).forEach((s) => { if (sellerValues.has(s.value)) s.selected = true; });
    fireChange(sellerSel);

    // 2) Source Seller – po chwili, żeby nie nadpisało tego filtrowanie listy
    setTimeout(() => {
      deselectAll(sourceSel);
      okSourceOpts.forEach((o) => { o.selected = true; });
      fireChange(sourceSel);
      console.log(LOG, 'filtr', { partner, sellers: [...sellerValues], source: okSourceOpts.map((o) => o.textContent.trim()) });
    }, 150);

    const lines = [
      '✔ seller: ' + Array.from(sellerValues).join(', '),
      '✔ source seller: ' + okSourceOpts.map((o) => o.textContent.trim()).join(', '),
    ];
    if (skipped.length) lines.push('⚠ skipped: ' + skipped.join('; '));
    setStatus(lines.join('\n'));
  }

  function clearAll(setStatus) {
    const sellerSel = document.getElementById('seller');
    const sourceSel = document.getElementById('source_seller');
    [sellerSel, sourceSel].forEach((sel) => {
      if (!sel) return;
      deselectAll(sel);
      if (sel.options[0]) sel.options[0].selected = true; // "All"
    });
    if (sellerSel) fireChange(sellerSel);
    setStatus('Cleared (All)');
  }

  // ───────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────
  function buildPanel() {
    if (document.getElementById('tm-partner-filter')) return;

    const box = document.createElement('div');
    box.id = 'tm-partner-filter';
    box.style.cssText = [
      'position:fixed', 'top:80px', 'right:12px', 'z-index:99999', 'width:270px',
      'background:#fff', `border:2px solid ${BRAND}`, 'border-radius:6px',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)', 'font:13px Arial,sans-serif', 'padding:8px',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Partner filter';
    title.style.cssText = `font-weight:bold;color:${BRAND};margin-bottom:6px;cursor:pointer`;

    const body = document.createElement('div');

    // Wyszukiwarka tylko przewija listę do dopasowania – niczego nie ukrywa
    const search = document.createElement('input');
    search.placeholder = 'Jump to partner...';
    search.style.cssText = 'width:100%;box-sizing:border-box;padding:4px;margin-bottom:6px';

    // Lista wszystkich partnerów – zawsze w całości, przewijana
    const list = document.createElement('div');
    list.style.cssText = 'max-height:240px;overflow-y:auto;border:1px solid #ccc;border-radius:4px;margin-bottom:6px';

    const items = {};
    let selected = null;
    const setStatus = (t) => { status.textContent = t; };

    const highlight = (name) => {
      if (selected && items[selected]) {
        items[selected].style.background = '';
        items[selected].style.color = '';
      }
      selected = name;
      if (name && items[name]) {
        items[name].style.background = BRAND;
        items[name].style.color = '#fff';
      }
    };

    Object.keys(PARTNERS).forEach((name) => {
      const row = document.createElement('div');
      row.textContent = name;
      row.style.cssText = 'padding:3px 6px;cursor:pointer';
      row.addEventListener('mouseenter', () => { if (name !== selected) row.style.background = '#f0e0e0'; });
      row.addEventListener('mouseleave', () => { if (name !== selected) row.style.background = ''; });
      row.addEventListener('click', () => {
        highlight(name);
        applyPartner(name, setStatus);
      });
      items[name] = row;
      list.appendChild(row);
    });

    search.addEventListener('input', () => {
      const q = norm(search.value);
      if (!q) return;
      const hit = Object.keys(items).find((n) => norm(n).startsWith(q)) || Object.keys(items).find((n) => norm(n).includes(q));
      if (hit) items[hit].scrollIntoView({ block: 'nearest' });
    });

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear (All)';
    clear.style.cssText = `background:${BRAND};color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer`;
    clear.addEventListener('click', () => { highlight(null); search.value = ''; clearAll(setStatus); });

    const status = document.createElement('pre');
    status.style.cssText = 'margin:8px 0 0;white-space:pre-wrap;font:12px Arial,sans-serif';

    title.addEventListener('click', () => { body.style.display = body.style.display === 'none' ? '' : 'none'; });

    body.append(search, list, clear, status);
    box.append(title, body);
    document.body.appendChild(box);
  }

  buildPanel();
  console.log(LOG, 'total-cycle-time-partner-filter v1.2.0 loaded');
})();

// ==UserScript==
// @name         Filtrowanie listy Shipping method + Country — Ticket
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Ogranicza listę "Shipping method #" do wybranych spedycji, z dodatkowym filtrem po kraju
// @author       kimrioter
// @match        www.prologistics.info/rma.php*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/shipping-method-country-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/shipping-method-country-filter.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM filter script by kimrioter] Start');

    const SELECT_ID = 'rtn_shipping_method';
    const COUNTRY_SELECT_ID = 'tm_country_filter';

    const ALLOWED_LABELS = {
        'CH: DHL (CH)': 'CH',
        'CH: DPD (CH)': 'CH',
        'CH: Swiss Post PostPac': 'CH',
        'CH: Swiss Post Sperrgut': 'CH',
        'CZ: GLS (CZ)': 'CZ',
        'DE: DHL WD R': 'DE',
        'DE: DPD': 'DE',
        'DE: GLS': 'DE',
        'DE: Hellmann': 'DE',
        'DE: Hellmann (Bulky goods)': 'DE',
        'DE: Hellmann (Packet)': 'DE',
        'DE: Noerpel Hannover': 'DE',
        'DK: BFT Logistik (DK)': 'DK',
        'ES: Tamdis': 'ES',
        'FR: CChez Vous': 'FR',
        'GB: DHL (UK)': 'GB',
        'GB: Higher Jump': 'GB',
        'HU: Futarszolgalat.hu': 'HU',
        'IT: TWS EXPRESS (home delivery)': 'IT',
        'NL: PostNL (Extra@Home) 1DR': 'NL',
        'NL: PostNL (Extra@Home) 2DR': 'NL',
        'NL: TSN Groen DD': 'NL',
        'NL: TSN Groen SD': 'NL',
        'PL: Ambro Express': 'PL',
        'PL: DHL (PL)': 'PL',
        'PL: DHL Parcel Point (PL)': 'PL',
        'PL: GLS (PL)': 'PL',
        'PL: GLS International (PL)': 'PL',
        'PL: Rohlig Suus (Paket)': 'PL',
        'PL: Rohlig Suus (Palette)': 'PL',
        'PL: Zadbano': 'PL',
        'RO: PTT Express': 'RO',
        'SE: DSV (NO)': 'SE',
        'SE: DSV (SE)': 'SE',
        'SE: DSV (FI)': 'SE',
    };

    const COUNTRIES = [...new Set(Object.values(ALLOWED_LABELS))].sort();

    let countrySelectAdded = false;

    function insertCountryDropdown(shippingSelect) {
        if (countrySelectAdded || document.getElementById(COUNTRY_SELECT_ID)) return;

        const fieldContainer = shippingSelect.closest('div');
        if (!fieldContainer || !fieldContainer.parentNode) return;

        const wrapper = document.createElement('div');

        const label = document.createElement('label');
        label.textContent = 'Country';
        label.setAttribute('for', COUNTRY_SELECT_ID);
        label.style.display = 'block';
        label.style.marginBottom = '2px';

        const select = document.createElement('select');
        select.id = COUNTRY_SELECT_ID;

        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All';
        select.appendChild(allOption);

        COUNTRIES.forEach(country => {
            const opt = document.createElement('option');
            opt.value = country;
            opt.textContent = country;
            select.appendChild(opt);
        });

        select.addEventListener('change', () => applyFilters(shippingSelect, select.value));

        wrapper.appendChild(label);
        wrapper.appendChild(select);

        fieldContainer.parentNode.insertBefore(wrapper, fieldContainer);
        countrySelectAdded = true;

        console.log('[TM filter script by kimrioter] Dodano dropdown Country jako osobne pole');
    }

    function applyFilters(shippingSelect, selectedCountry) {
        let visibleCount = 0;

        Array.from(shippingSelect.options).forEach(option => {
            const label = option.textContent.trim();

            if (label === '---' || label === '') {
                option.hidden = false;
                option.disabled = false;
                return;
            }

            const country = ALLOWED_LABELS[label];
            const isAllowed = !!country;
            const matchesCountry = !selectedCountry || country === selectedCountry;
            const shouldShow = isAllowed && matchesCountry;

            option.hidden = !shouldShow;
            option.disabled = !shouldShow;

            if (shouldShow) visibleCount++;
        });

        console.log('[TM filter script by kimrioter] Widocznych po filtrze (' + (selectedCountry || 'All') + '):', visibleCount);
    }

    function setup() {
        const shippingSelect = document.getElementById(SELECT_ID);
        if (!shippingSelect) return;

        insertCountryDropdown(shippingSelect);

        const currentCountrySelect = document.getElementById(COUNTRY_SELECT_ID);
        const currentCountryValue = currentCountrySelect ? currentCountrySelect.value : '';

        applyFilters(shippingSelect, currentCountryValue);
    }

    setup();

    const observer = new MutationObserver(() => setup());
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[TM filter script by kimrioter] Zainicjalizowano observer');
})();

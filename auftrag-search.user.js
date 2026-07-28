// ==UserScript==
// @name         Auftrag Search (Beliani Direct Fulfilment)
// @namespace    https://www.prologistics.info/
// @version      1.2
// @description  Text selection with Beliani Icon to search directly as Fulfilment on ProLogistics.
// @author       kimrioter
// @match        *://*/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search.user.js
// @downloadURL  https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search.user.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('[TM Auftrag Search by kimrioter] Start');

    const COLORS = {
        accent: '#ff2f00' // Beliani Red
    };

    const BELIANI_LOGO_URL = 'https://i.snipboard.io/CxDQj3.jpg';

    const BELIANI_IMG = `<img src="${BELIANI_LOGO_URL}" style="width:18px; height:18px; object-fit:contain; vertical-align:middle; border-radius:3px;" alt="B">`;

    const FULFILMENT_URL_TEMPLATE = 'https://www.prologistics.info/search.php?days1=&ppp_not_booked_solved=0&ebay_shp_days=&days3=&days8=&days5=&days2=&partner_unpaid_date=&calc_listing_fee_dn=&listingfees_open_days=&number=&what=ff_number&ff_number={FF_NUMBER}&email=&buyer_name=&company=&name=&street=&zip=&city=&tel=&seller_name=&invoice_number=&offer_id=&galleryURL=&shipping_country=PB&shipping_country_seller=&shipping_country_from=YYYY-MM-DD&shipping_country_to=YYYY-MM-DD&tracking_number=&return_tracking_number=&label_number=&deleted_uname=&payment_comment=&open_amount_mode=any&open_amount_from=&open_amount_to=&open_amount_currency=&direct_offer_id=&fix_number=&shipping_order_country=&shipping_order_warehouse=&sold_price_seller_name=&sold_price=&sold_price_currency=CAD&unshipped_bonus_country=AT&unshipped_orders_country=&status%5B%5D=ticket_opened&status%5B%5D=uncompleted&status%5B%5D=unpaid&status%5B%5D=ready_to_ship&status%5B%5D=ins&source_seller=0&comment=&comment_src=&alarm_mode=Pending&alarm_username=Rykaczewski&alarm_type=&payment_method=1&payment_method_date_from=&payment_method_date_to=&rma_sell_html_paid=0&rma_sell_html=&rma_sell_auction=&rma_sell_auction_number=&custom_invoice_paid_resp=&secchance_base_auction_number=&secchance_saved_id=&secchance_buyer=&rma_sold_notsold=1&rma_sold_notsold_warehouse=255&since_year=&to_year=&article_id=&article_name=&article_id_edit=&spec_order_OPS=&spec_order_shipped=0&new_article_completed=0&saved_saved_id=&saved_saved_name=&saved_saved_ean=&article_article_id=&article_article_name=&article_supplier_article_id=&merchant_item_id=&merchant_item_name=&issue_log_id=&deleted_doc=&pcs=';

    function buildFulfilmentUrl(number) {
        return FULFILMENT_URL_TEMPLATE.replace('{FF_NUMBER}', encodeURIComponent(number));
    }

    function openInNewTab(url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    // --- SELECTION BUTTON (BELIANI FLOATING ICON) ---
    let selectionBtn = null;

    function removeSelectionButton() {
        if (selectionBtn) {
            selectionBtn.remove();
            selectionBtn = null;
        }
    }

    document.addEventListener('mouseup', () => {
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection ? selection.toString().trim() : '';

            if (selectedText.length > 0 && selectedText.length < 50) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                if (!selectionBtn) {
                    selectionBtn = document.createElement('div');
                    selectionBtn.id = 'beliani-search-btn';
                    selectionBtn.title = 'Szukaj Fulfilment w ProLogistics';
                    selectionBtn.innerHTML = BELIANI_IMG;
                    selectionBtn.style.cssText = `
                        position: absolute;
                        z-index: 999998;
                        background: #ffffff;
                        border: 1.5px solid ${COLORS.accent};
                        border-radius: 50%;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    `;

                    selectionBtn.addEventListener('mouseenter', () => {
                        selectionBtn.style.transform = 'scale(1.15)';
                        selectionBtn.style.boxShadow = '0 6px 16px rgba(255,47,0,0.25)';
                    });
                    selectionBtn.addEventListener('mouseleave', () => {
                        selectionBtn.style.transform = 'scale(1)';
                        selectionBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    });

                    // Od razu po kliknięciu szukamy jako Fulfilment i usuwamy ikonkę
                    selectionBtn.addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        openInNewTab(buildFulfilmentUrl(selectedText));
                        removeSelectionButton();
                    });

                    document.body.appendChild(selectionBtn);
                }

                const topPos = window.scrollY + rect.top - 36;
                const leftPos = window.scrollX + rect.left + (rect.width / 2) - 15;

                selectionBtn.style.top = `${topPos < 0 ? 5 : topPos}px`;
                selectionBtn.style.left = `${leftPos < 0 ? 5 : leftPos}px`;
            } else {
                removeSelectionButton();
            }
        }, 10);
    });

    document.addEventListener('mousedown', (e) => {
        if (selectionBtn && !selectionBtn.contains(e.target)) {
            removeSelectionButton();
        }
    });
})();

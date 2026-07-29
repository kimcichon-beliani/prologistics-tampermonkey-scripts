# Prologistics — Skrypty Tampermonkey

Zbiór skryptów userscript usprawniających pracę w systemie [prologistics.info](https://www.prologistics.info/).[cite: 5]

Autor: **kimrioter**[cite: 5]

## Jak zainstalować

1. Zainstaluj rozszerzenie [Tampermonkey](https://www.tampermonkey.net/) w przeglądarce.[cite: 5]
2. Kliknij link "Raw" przy wybranym skrypcie poniżej (lub wejdź bezpośrednio w plik `.user.js` w tym repozytorium i kliknij **Raw**).[cite: 5]
3. Tampermonkey powinien automatycznie wykryć plik i zaproponować instalację.[cite: 5]
4. Po instalacji skrypt będzie się aktualizował automatycznie (Tampermonkey sprawdza aktualizacje co ok. 24h).[cite: 5]

## Lista skryptów

### 🔴 empty-rows-highlight.user.js
**Podświetlanie pustych wierszy — Mark as shipped / No labels found**[cite: 5]
Podświetla na czerwono wiersze w tabelach, w których:[cite: 5]
- kolumna "Mark as shipped" jest pusta (tabela Total Cycle Time),[cite: 5]
- kolumna "Shipping labels" zawiera "No labels found" przy sprawdzaniu labeli dla Trademaxa.[cite: 5]

### 🔤 total-cycle-time-alpha-sort.user.js
**Sortowanie list wyboru alfabetycznie — Total Cycle Time**[cite: 5]
Sortuje alfabetycznie opcje w listach wielokrotnego wyboru (np. "Seller", "Source seller") na stronie filtra Total Cycle Time, z opcją "All" zawsze przypiętą na górze. Działa tylko na `total_cycle_time.php`.[cite: 5]

### 🚚 shipping-method-country-filter.user.js
**Filtrowanie listy Shipping method + Country — Ticket**[cite: 5]
W Tickecie, przy polu "Shipping method #", ogranicza listę do wybranych spedycji i dodaje dodatkowy dropdown "Country" do szybkiego filtrowania spedycji po kraju.[cite: 5]

### 📋 import-setting-sort.user.js
**Czysta i posortowana lista Import Setting (Material UI)**[cite: 5]
Na stronie `react/settings_page/import_tool/`, w liście "Import setting" (widocznej po wybraniu Type: Mass Invoice) ukrywa numery ID partnerów i sortuje listę alfabetycznie po nazwie.[cite: 5]

### 📐 sidebar-collapse.user.js
**Zwijany sidebar — Prologistics**[cite: 5]
Pozwala schować/rozwinąć boczne menu w dowolnym momencie przyciskiem "☰". Po zwinięciu wciąż widoczne (w formie pionowego tekstu, przyklejonego do lewej krawędzi i przewijającego się z użytkownikiem) pozostają: link "Logout" oraz czas pracy z przyciskiem "LOG OUT". Stan (zwinięty/rozwinięty) jest zapamiętywany między odświeżeniami strony. Nie działa na podstronach `/react/` (dynamiczne aplikacje React mają już nowocześniejszy interfejs i mogłyby kolidować ze skryptem).[cite: 5]

### 🔤 sellers-sort.user.js
**Sortowanie list Sellers + Source seller — Calculations**[cite: 5]
Na stronie `calcs.php` sortuje alfabetycznie listę "Sellers" oraz listę "Source seller". Kiedy zaznaczonych jest kilku Sellerów naraz, ich pozycje "Source seller" łączą się w jedną wspólną, alfabetyczną listę (zamiast pokazywać osobne bloki dla każdego Sellera). Działa poprzez nasłuchiwanie kliknięć/zmian w fazie przechwytywania i normalnej fazie, więc nie ingeruje bezpośrednio w wewnętrzną logikę strony (`showHideSources()`).[cite: 5]

### 💳 payment-status.user.js
**Status płatności — Payments**[cite: 5]
Na stronie `auction.php` dopisuje status płatności ("Unpaid order" / "Order paid in full" / "Overpayment") w istniejącej, pustej kolumnie tabelki "Payments" — status obejmuje wspólnie wiersze "Total of Payments" i "Auftrag value - Total of Payments". Kwota jest rozpoznawana niezależnie od waluty (€, Lei, zł itd.). Odświeża się automatycznie po dodaniu nowej płatności bez przeładowania strony.[cite: 5]

### 👁️ hide-columns-seller-sources.user.js
**Ukrywanie kolumn — Source sellers**[cite: 5]
Na stronie `seller_sources.php` dodaje panel "⚙ Kolumny" (pod polem "Status" w formularzu filtrów) z checkboxami dla każdej kolumny tabeli — pozwala dowolnie włączać/wyłączać ich widoczność. Domyślnie ukrywa 13 rzadziej potrzebnych kolumn (np. Beezup adress, Provision in %, Clearing account itd.). Wybór zapamiętywany jest w przeglądarce między wizytami.[cite: 5]

### 🔍 auftrag-search.user.js
**Auftrag Search (Beliani Direct Fulfilment)**[cite: 5]
Działa na każdej stronie (np. Mirakl/Maxeda). Po zaznaczeniu dowolnego tekstu (do 50 znaków) pojawia się mała, pływająca ikonka Beliani — kliknięcie w nią otwiera w nowej karcie wyszukiwanie tego numeru jako Fulfilment bezpośrednio w Prologistics (przez szybki link "express", od razu przenoszący do zamówienia, bez listy wyników).[cite: 5]

### 🏷️ express-label-generator.user.js
**Express Label Generator — RMA**
Na stronie `rma.php` po kliknięciu przycisku "Label for client" automatycznie generuje pełną etykietę klienta w nowej karcie (wybierając domyślnie brak magazynu) i natychmiast zamyka pop-up "Choose warehouse", eliminując zbędne ręczne kliknięcia.

## Uwagi

- Wszystkie skrypty działają na domenie `https://www.prologistics.info/`.[cite: 5]
- W razie problemów po aktualizacji strony (np. zmiana struktury tabeli) sprawdź konsolę przeglądarki (F12) — skrypty logują swoje działanie z prefiksem `[TM script by kimrioter]`.[cite: 5]

# Prologistics — Skrypty Tampermonkey

Zbiór skryptów userscript usprawniających pracę w systemie [prologistics.info](https://www.prologistics.info/).

Autor: **kimrioter**

## Jak zainstalować

1. Zainstaluj rozszerzenie [Tampermonkey](https://www.tampermonkey.net/) w przeglądarce.
2. Kliknij link "Raw" przy wybranym skrypcie poniżej (lub wejdź bezpośrednio w plik `.user.js` w tym repozytorium i kliknij **Raw**).
3. Tampermonkey powinien automatycznie wykryć plik i zaproponować instalację.
4. Po instalacji skrypt będzie się aktualizował automatycznie (Tampermonkey sprawdza aktualizacje co ok. 24h).

## Lista skryptów

### 🔴 empty-rows-highlight.user.js
**Podświetlanie pustych wierszy — Mark as shipped / No labels found**
Podświetla na czerwono wiersze w tabelach, w których:
- kolumna "Mark as shipped" jest pusta (tabela Total Cycle Time),
- kolumna "Shipping labels" zawiera "No labels found" przy sprawdzaniu labeli dla Trademaxa.

### 🔤 total-cycle-time-alpha-sort.user.js
**Sortowanie list wyboru alfabetycznie — Total Cycle Time**
Sortuje alfabetycznie opcje w listach wielokrotnego wyboru (np. "Seller", "Source seller") na stronie filtra Total Cycle Time, z opcją "All" zawsze przypiętą na górze. Działa tylko na `total_cycle_time.php`.

### 🚚 shipping-method-country-filter.user.js
**Filtrowanie listy Shipping method + Country — Ticket**
W Tickecie, przy polu "Shipping method #", ogranicza listę do wybranych spedycji i dodaje dodatkowy dropdown "Country" do szybkiego filtrowania spedycji po kraju.

### 📋 import-setting-sort.user.js
**Czysta i posortowana lista Import Setting (Material UI)**
Na stronie `react/settings_page/import_tool/`, w liście "Import setting" (widocznej po wybraniu Type: Mass Invoice) ukrywa numery ID partnerów i sortuje listę alfabetycznie po nazwie.

### 📐 sidebar-collapse.user.js

**Zwijany sidebar — Prologistics** 
Pozwala schować/rozwinąć boczne menu w dowolnym momencie przyciskiem "☰". Po zwinięciu wciąż widoczne (w formie pionowego tekstu, przyklejonego do lewej krawędzi i przewijającego się z użytkownikiem) pozostają: link "Logout" oraz czas pracy z przyciskiem "LOG OUT". Stan (zwinięty/rozwinięty) jest zapamiętywany między odświeżeniami strony. Nie działa na podstronach /react/ (dynamiczne aplikacje React mają już nowocześniejszy interfejs i mogłyby kolidować ze skryptem).

### 🔤 sellers-sort.user.js

**Sortowanie list Sellers + Source seller — Calculations**
Na stronie 'calcs.php' sortuje alfabetycznie listę "Sellers" oraz listę "Source seller". Kiedy zaznaczonych jest kilku Sellerów naraz, ich pozycje "Source seller" łączą się w jedną wspólną, alfabetyczną listę (zamiast pokazywać osobne bloki dla każdego Sellera). Działa poprzez nasłuchiwanie kliknięć/zmian w fazie przechwytywania i normalnej fazie, więc nie ingeruje bezpośrednio w wewnętrzną logikę strony '(showHideSources())'.

### 💳 payment-status.user.js

**Status płatności — Payments**
Na stronie auction.php dopisuje status płatności ("Unpaid order" / "Order paid in full" / "Overpayment") w istniejącej, pustej kolumnie tabelki "Payments" — status obejmuje wspólnie wiersze "Total of Payments" i "Auftrag value - Total of Payments". Kwota jest rozpoznawana niezależnie od waluty (€, Lei, zł itd.). Odświeża się automatycznie po dodaniu nowej płatności bez przeładowania strony.

### 👁️ hide-columns-seller-sources.user.js

**Ukrywanie kolumn — Source sellers**
Na stronie seller_sources.php dodaje panel "⚙ Kolumny" (pod polem "Status" w formularzu filtrów) z checkboxami dla każdej kolumny tabeli — pozwala dowolnie włączać/wyłączać ich widoczność. Domyślnie ukrywa 13 rzadziej potrzebnych kolumn (np. Beezup adress, Provision in %, Clearing account itd.). Wybór zapamiętywany jest w przeglądarce między wizytami.

## Uwagi

- Wszystkie skrypty działają na domenie `https://www.prologistics.info/`.
- W razie problemów po aktualizacji strony (np. zmiana struktury tabeli) sprawdź konsolę przeglądarki (F12) — skrypty logują swoje działanie z prefiksem `[TM script by kimrioter]`.

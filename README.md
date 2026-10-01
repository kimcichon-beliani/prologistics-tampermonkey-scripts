# Prologistics — Skrypty Tampermonkey

Zbiór skryptów userscript usprawniających pracę w systemie [prologistics.info](https://www.prologistics.info/) oraz w narzędziach, z których korzystamy na co dzień (Google Sheets, portale marketplace'ów).

Autor: **kimrioter**

## Jak zainstalować

1. Zainstaluj rozszerzenie [Tampermonkey](https://www.tampermonkey.net/) w przeglądarce.
2. Kliknij link **Instaluj** przy wybranym skrypcie poniżej (lub otwórz plik `.user.js` w repozytorium i kliknij **Raw**).
3. Tampermonkey automatycznie wykryje plik i zaproponuje instalację.
4. Po instalacji skrypt aktualizuje się sam (Tampermonkey sprawdza aktualizacje co ok. 24h).

## Spis skryptów

| Obszar | Skrypty |
|---|---|
| [Prologistics — Auftrag (`auction.php`)](#prologistics--auftrag-auctionphp) | Modern Auftrag Toolbar, A Better Look, Auction Pinned Panels, Status płatności |
| [Prologistics — RMA (`rma.php`)](#prologistics--rma-rmaphp) | RMA Auftrag Copy + Pinned Panels, Return Tracking pod Closing Notification, Express Label Generator |
| [Prologistics — listy, filtry i tabele](#prologistics--listy-filtry-i-tabele) | Podświetlanie pustych wierszy, sortowania list, ukrywanie kolumn, Shipping method + Country, Employees |
| [Prologistics — cały system](#prologistics--cały-system) | Tryb ciemny, zwijany sidebar |
| [Wyszukiwanie Auftrag z innych stron](#wyszukiwanie-auftrag-z-innych-stron) | Auftrag Search, Auftrag Search (Google Sheets) |
| [Google Sheets](#google-sheets) | Filtr Cashback |
| [Portale marketplace'ów](#portale-marketplaceów) | Galaxus, BricoBravo |

---

## Prologistics — Auftrag (`auction.php`)

### 🧭 modern-auftrag-toolbar.user.js
**Nowoczesny pasek nawigacji — Auftrag** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/modern-auftrag-toolbar.user.js)

Całkowicie zastępuje stary, surowy pasek nawigacyjny nowym panelem. Skraca etykiety przycisków (np. "Go to Article" → "Article", "Open New Ticket" → "New Ticket"), dodaje płynne przewijanie do sekcji oraz wyróżnia najważniejsze akcje ("New Ticket" i aktywny "Change Order") bordowym kolorem Prologistics.

### ✨ prologistics-better-look-auftrag.user.js
**A Better Look — Auftrag** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-better-look-auftrag.user.js)

Porządkuje układ strony zamówienia:
- przenosi sekcję **Articles** (od Tracking numbers do Printer log) **nad Calculation Tables** — pola formularzy są przypinane do swoich oryginalnych formularzy, więc wszystko dalej zapisuje się poprawnie,
- przenosi wiersz z przyciskiem **Resume emails** tuż pod wiersz **Auftrag #**,
- odświeża wygląd wszystkich przycisków (zaokrąglenia, hover, wyraźnie wyszarzone przyciski nieaktywne) bez zmiany ich kolorów.

### 📌 auction-pinned-panels.user.js
**Auction Pinned Panels (Customer / Articles / Payments)** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auction-pinned-panels.user.js)

Dodaje po prawej stronie ekranu stos przypiętych paneli, widocznych cały czas podczas scrollowania (wygląd jak w skrypcie RMA Auftrag # Copy + Pinned Panels):
- **Customer** — dane klienta z przełącznikiem zakładek **Shipping / Billing**, numer Fulfillment z przyciskiem copy oraz przyciski "Copy address" i "Copy e-mail",
- **Articles** — pozycje z tabeli Articles (ID z przyciskiem copy, nazwa, ilość, tracking, status), z kontrolą zgodności z liczbą pozycji w belce "Articles (N)",
- **Payments** — cena, dostawa, COD, bonusy i suma, odczytywane z linii kontrolnej faktury (działa niezależnie od języka zamówienia); przy **cenie 0** pokazuje czerwone ostrzeżenie, a jeśli zamówienie powstało z ticketu — także link do tego ticketu.

Każdy panel można zwinąć klikając w nagłówek, a wybrana zakładka (Shipping/Billing) i stan zwinięcia są zapamiętywane.

### 💳 payment-status.user.js
**Status płatności — Payments** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/payment-status.user.js)

Dopisuje status płatności ("Unpaid order" / "Order paid in full" / "Overpayment") w istniejącej, pustej kolumnie tabelki "Payments" — status obejmuje wspólnie wiersze "Total of Payments" i "Auftrag value - Total of Payments". Kwota jest rozpoznawana niezależnie od waluty (€, Lei, zł itd.). Odświeża się automatycznie po dodaniu nowej płatności, bez przeładowania strony.

---

## Prologistics — RMA (`rma.php`)

### 📋 rma-auftrag-copy.user.js
**RMA Auftrag # Copy + Pinned Panels** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/rma-auftrag-copy.user.js)

Usprawnienia na stronie ticketu RMA:
- przycisk **copy** obok numeru Auftrag w sekcji "Auftrag Details" — kopiuje sam numer zamówienia, bez pozycji (`15333852 / 3` → `15333852`); link do zamówienia pozostaje klikalny,
- przypięty w prawym górnym rogu panel **Customer Data (shipping)** z numerem ticketu i danymi wysyłkowymi klienta (Company, Name, Address, Phone, Mobile, Email), bez suffiksu "(Shipping)" w etykietach; linki w polach Address i Email pozostają aktywne,
- przypięty panel z **cenami zwrotu** (Return prices).

Panele można zwinąć klikając w nagłówek — stan jest zapamiętywany.

### 🔁 prologistics-rma-return-tracking-move.user.js
**RMA — Return Tracking pod Closing Notification** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-rma-return-tracking-move.user.js)

Zbiera w jednym miejscu, **pod przyciskiem "Closing Notification"**, wszystko, czego potrzeba przy obsłudze zwrotu:
- tabelę **Return tracking numbers** oraz formularz **Tracking # / Update**,
- przycisk **Label for client**,
- przycisk **Return prices** — razem z tabelą cen, która pojawia się po kliknięciu (oryginalny przycisk zostaje na swoim miejscu, a wyniki są odzwierciedlane pod formularzem).

Tabela "Tracking numbers" (packingowa) i "New driver task" zostają tam, gdzie były.

### 🏷️ express-label-generator.user.js
**Express Label Generator — RMA** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/express-label-generator.user.js)

Po kliknięciu przycisku "Label for client" automatycznie generuje pełną etykietę klienta w nowej karcie (wybierając domyślnie brak magazynu) i natychmiast zamyka pop-up "Choose warehouse".

---

## Prologistics — listy, filtry i tabele

### 🔴 empty-rows-highlight.user.js
**Podświetlanie pustych wierszy — Mark as shipped / No labels found** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/empty-rows-highlight.user.js)

Podświetla na czerwono wiersze w tabelach, w których:
- kolumna "Mark as shipped" jest pusta (tabela Total Cycle Time),
- kolumna "Shipping labels" zawiera "No labels found" przy sprawdzaniu labeli dla Trademaxa.

### 🔤 total-cycle-time-alpha-sort.user.js
**Sortowanie list wyboru alfabetycznie — Total Cycle Time** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/total-cycle-time-alpha-sort.user.js)

Sortuje alfabetycznie opcje w listach wielokrotnego wyboru (np. "Seller", "Source seller") na stronie filtra Total Cycle Time, z opcją "All" zawsze przypiętą na górze. Działa tylko na `total_cycle_time.php`.

### 🔤 sellers-sort.user.js
**Sortowanie list Sellers + Source seller — Calculations** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/sellers-sort.user.js)

Na stronie `calcs.php` sortuje alfabetycznie listę "Sellers" oraz listę "Source seller". Kiedy zaznaczonych jest kilku Sellerów naraz, ich pozycje "Source seller" łączą się w jedną wspólną, alfabetyczną listę. Skrypt nie ingeruje bezpośrednio w wewnętrzną logikę strony (`showHideSources()`).

### 👁️ hide-columns-seller-sources.user.js
**Ukrywanie kolumn — Source sellers** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/hide-columns-seller-sources.user.js)

Na stronie `seller_sources.php` dodaje panel "⚙ Kolumny" (pod polem "Status" w formularzu filtrów) z checkboxami dla każdej kolumny tabeli. Domyślnie ukrywa 13 rzadziej potrzebnych kolumn (np. Beezup adress, Provision in %, Clearing account). Wybór jest zapamiętywany w przeglądarce.

### 📋 import-setting-sort.user.js
**Czysta i posortowana lista Import Setting (Material UI)** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/import-setting-sort.user.js)

Na stronie `react/settings_page/import_tool/`, w liście "Import setting" (widocznej po wybraniu Type: Mass Invoice), ukrywa numery ID partnerów i sortuje listę alfabetycznie po nazwie.

### 🚚 shipping-method-country-filter.user.js
**Filtrowanie listy Shipping method + Country — Ticket** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/shipping-method-country-filter.user.js)

W Tickecie, przy polu "Shipping method #", ogranicza listę do wybranych spedycji i dodaje dropdown "Country" do szybkiego filtrowania spedycji po kraju.

### 👥 prologistics-employees-id-desc.user.js
**Employees — ID od najnowszego** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-employees-id-desc.user.js)

Na stronie `react/settings_page/employees` zawsze ustawia sortowanie tabeli po **ID malejąco**, więc najnowsi pracownicy są na górze — także po kliknięciu "Filter". Jeśli samodzielnie posortujesz tabelę po innej kolumnie, skrypt tego nie nadpisuje.

---

## Prologistics — cały system

### 🌙 prologistics-dark-mode-toggle.user.js
**Tryb ciemny (Dark Mode)** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/prologistics-dark-mode-toggle.user.js)

Dodaje pływający przełącznik trybu ciemnego i jasnego w prawym górnym rogu ekranu. Działa na każdej podstronie systemu, odwracając kolory za pomocą filtrów CSS.

- **Brak "błysku" ekranu** — zapamiętany motyw wczytuje się już na samym początku ładowania strony (`document-start`), bez mignięcia białego tła.
- **Ochrona obrazów** — zdjęcia, wideo i iframe zachowują oryginalne barwy.
- **Trwała pamięć** — raz włączony tryb ciemny zostaje włączony przy kolejnych wizytach.

### 📐 sidebar-collapse.user.js
**Zwijany sidebar** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/sidebar-collapse.user.js)

Pozwala schować/rozwinąć boczne menu przyciskiem "☰". Po zwinięciu wciąż widoczne (jako pionowy tekst przyklejony do lewej krawędzi) pozostają: link "Logout" oraz czas pracy z przyciskiem "LOG OUT". Stan jest zapamiętywany między odświeżeniami strony.

---

## Wyszukiwanie Auftrag z innych stron

### 🔍 auftrag-search.user.js
**Auftrag Search (Beliani Direct Fulfilment)** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search.user.js)

Działa na każdej stronie (np. Mirakl/Maxeda). Po zaznaczeniu tekstu (do 50 znaków) pojawia się mała ikonka Beliani — kliknięcie otwiera w nowej karcie wyszukiwanie tego numeru jako Fulfilment w Prologistics (szybki link "express", od razu do zamówienia, bez listy wyników).

### ⌨️ auftrag-search-gsuite.user.js
**Auftrag Search (Google Sheets Shortcut)** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/auftrag-search-gsuite.user.js)

Wersja wyszukiwarki dla **Google Sheets i Google Docs**, gdzie zwykłe zaznaczanie tekstu nie działa. Skrót **Ctrl + Shift + F** otwiera w nowej karcie Auftrag w Prologistics dla zaznaczonego tekstu, zawartości aktywnej komórki lub paska formuł. Jeśli Google zablokuje odczyt, pojawi się okienko do wpisania/potwierdzenia numeru.

---

## Google Sheets

### 💸 gsheet-cashback-filter.user.js
**GSheet — filtr Cashback (Deal Type)** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/gsheet-cashback-filter.user.js)

Dodaje w prawym dolnym rogu arkusza przycisk **💸 Cashback**, który otwiera osobny panel z wierszami przefiltrowanymi po kolumnie B "Deal Type" (domyślnie fraza "cashback"). Działa także na arkuszach udostępnionych **tylko do podglądu**, gdzie nie da się użyć wbudowanego filtra.

W panelu można zmienić frazę filtra, przeszukać wyniki, odświeżyć dane, skopiować wyniki (do wklejenia w Excel/Sheets) lub pobrać je jako CSV. Pokazywane są dane z aktualnie otwartej zakładki arkusza. Jeśli właściciel arkusza zablokował pobieranie/kopiowanie dla przeglądających, skrypt nie pobierze danych.

---

## Portale marketplace'ów

### 🛒 galaxus-positions-highlight-vat.user.js
**Galaxus Partner Portal — Positions highlight + VAT** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/prologistics-tampermonkey-scripts/main/galaxus-positions-highlight-vat.user.js)

Na stronie zamówienia w `partner.galaxus.ch` (Supplier Purchase Order), w sekcji **Positions**:
- wyróżnia kolumny **Manufacturer no.**, **Quantity** (powiększona liczba) i **Unit price excl.**,
- pod ceną netto (Unit price i Total price) pokazuje na zielono **kwotę brutto z doliczonym VAT 8,1%** z podpisem "(cena do prolo)".

Stawkę VAT, sposób wyświetlania (w tej samej komórce lub w osobnej kolumnie) i podpisy można zmienić w sekcji KONFIGURACJA na początku skryptu.

### 🇮🇹 bricobravo-orders-highlighter.user.js
**BricoBravo SellerHub — kolorowanie zamówień + "Added to prolo?"** · [Instaluj](https://raw.githubusercontent.com/kimcichon-beliani/bricobravo-sellerhub-scripts/main/bricobravo-orders-highlighter.user.js)

> Skrypt jest w osobnym repozytorium: [bricobravo-sellerhub-scripts](https://github.com/kimcichon-beliani/bricobravo-sellerhub-scripts).

Na liście zamówień `sellerhub.bricobravo.com/orders`:
- zamówienia w statusie "Da spedire" starsze niż **2 dni** podświetla na czerwono — im starsze, tym ciemniejszy odcień (dokładny wiek widać po najechaniu na wiersz),
- zamówienia w statusie "Completato" podświetla delikatnie na zielono,
- dodaje kolumnę **ADDED TO PROLO?** z checkboxem — zaznaczenie gasi czerwone podświetlenie, a wybór jest zapamiętywany w przeglądarce.

---

## Uwagi

- Większość skryptów działa na `https://www.prologistics.info/`. Wyjątki: Auftrag Search (dowolna strona), skrypty dla Google Sheets/Docs, Galaxus Partner Portal i BricoBravo SellerHub.
- Skrypty zapamiętujące ustawienia (zwinięte panele, ukryte kolumny, checkboxy "Added to prolo?" itd.) zapisują je **lokalnie w przeglądarce** — nie przenoszą się między komputerami ani przeglądarkami.
- W razie problemów po aktualizacji strony (np. zmiana struktury tabeli) sprawdź konsolę przeglądarki (F12) — skrypty logują swoje działanie z prefiksem `[TM script by kimrioter]`.

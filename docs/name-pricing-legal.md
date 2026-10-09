# AccessRadar: nazwa, ceny, pytania prawne

**Przygotowano:** 9.10.2026, ok. 18:50 (czas warszawski) · **Dla:** Marcin · **Źródła:** Atlassian Marketplace REST API v2 (`/rest/2/addons`, `/rest/2/addons/{key}`, `/versions/latest`, `/pricing/cloud/live`), strony web podane przy wynikach, kod w `/workspace/accessradar` (commit `6b295ce` + niezacommitowane zmiany UI w drzewie roboczym), `docs/LISTING.md`.
**Surowe dane:** `docs/research-raw/pricing.json` (pełne odpowiedzi cenowe), `docs/research-raw/price-table.json` (wyliczenia), `docs/research-raw/name-search-summary.json` (wyniki wyszukiwania nazw z URL-ami zapytań).

Zasada: liczby pochodzą wyłącznie z API lub ze stron, które podaję. Czego nie dało się sprawdzić, oznaczam jako **NIESPRAWDZONE** albo **brak danych**.

---

## 0. Najważniejsze w 6 punktach

1. **Nazwa „AccessRadar” jest wolna w Marketplace.** 0 wyników dla `AccessRadar`, `accessradar`, `access-radar`, `PermissionRadar`, `AuditRadar` we wszystkich hostingach (bez filtra, cloud, server, datacenter). Klucze `accessradar`, `access-radar`, `com.radrly.accessradar` i podobne zwracają 404. Poza Marketplace ta sama nazwa jest już używana: skaner dostępności WCAG (WCAG.World, getaccessradar.com) oraz IAM/GRC „Vennx Access Radar” (Brazylia). Rejestrów znaków towarowych (EUIPO/WIPO) **nie udało się sprawdzić** automatycznie, więc ten punkt jest NIESPRAWDZONY.
2. **Pełna nazwa nie koliduje dosłownie z niczym, ale jej opisowa część jest prawie identyczna z dwoma konkurentami:** *AccessLens — Permission Audit & Access Review for Jira* oraz *Clearance for Jira (Permission Audit & Access Review)*. To nie jest problem prawny (sformułowanie jest opisowe), ale osłabia wyróżnienie w wynikach wyszukiwania. Alternatywa A z LISTING.md (*Permission Audit & Access Reviews*) jest jeszcze bliższa AccessLens, więc jej nie polecam.
3. **Nisza jest zatłoczona i nikt w niej nie ma trakcji.** Znalazłem **20 aplikacji** typu access review / permission audit dla Jira Cloud (19 płatnych i darmową Akeles). Żadna nie przekracza 114 instalacji, a większość ma 0–3. Cena za 100 użytkowników rocznie wynosi od **$100 do $4 530**, mediana **$900**. Aplikacje adminowe z realną trakcją (750+ instalacji) biorą **$1.00/user** w progu 11–100.
4. **Rekomendacja cenowa:** darmowo dla 1–10 użytkowników, potem **$0.75 / $0.55 / $0.35 / $0.20 / $0.15 / $0.12** za użytkownika miesięcznie. Daje to **$750 rocznie za 100 użytkowników**, poniżej mediany niszy i tak samo jak w MarginRadar w progu 11–100. Szczegóły i warianty w §2.4.
5. **Błąd w LISTING.md §8:** przykłady cen liczą płatnych użytkowników dopiero od 11. (np. „100 users $54.00 = $540/year”). Atlassian liczy jednak próg 11–100 od pierwszego użytkownika. Zweryfikowałem to na 26 aplikacjach (cena roczna / 10 = suma progresywna od 1. użytkownika). Przy starej propozycji $0.60 prawidłowo wychodzi **100 u. = $60/mies. = $600/rok**, a nie $540. Trzeba to poprawić w LISTING.md.
6. **Prawo i prywatność:** z 7 pytań [TO CONFIRM] 3 wymagają prawnika (kontroler/procesor, CCPA, transfer poza EOG). Kod ujawnił też 4 rzeczy do poprawy przed submitem (§3.3). Najważniejsza: po zamknięciu konta zamieniamy tylko wyświetlaną nazwę, a accountId zostaje w snapshotach, recenzjach i audit logu. To pseudonimizacja, a nie usunięcie danych.

---

## 1. Wyłączność nazwy

### 1.1 Atlassian Marketplace: REST API (9.10.2026)

Zapytania: `https://marketplace.atlassian.com/rest/2/addons?text=<fraza>&limit=50[&hosting=cloud|server|datacenter]`. Pole `count` to łączna liczba trafień wyszukiwarki pełnotekstowej (dopasowanie po słowach, nie po całej frazie).

| Fraza | Bez filtra | cloud | server | datacenter | Wniosek |
|---|---:|---:|---:|---:|---|
| `AccessRadar` | **0** | **0** | **0** | **0** | Brak aplikacji o tej nazwie |
| `accessradar` | **0** | **0** | **0** | **0** | j.w. |
| `access-radar` | **0** | **0** | **0** | **0** | j.w. |
| `PermissionRadar` | **0** | **0** | **0** | **0** | j.w. |
| `AuditRadar` | **0** | **0** | **0** | **0** | j.w. |
| `Access Radar` (dwa słowa) | 1 885 | 1 556 | 449 | 383 | Same trafienia na „Access” lub „Radar” osobno. **Żadna** aplikacja nie ma w nazwie „Access Radar” |
| `Radar` | 26 | 23 | 4 | 0 | 15 aplikacji z „Radar” w nazwie (lista niżej), żadna o dostępie/uprawnieniach |

Przykładowe URL-e zapytań:
- https://marketplace.atlassian.com/rest/2/addons?text=AccessRadar&limit=50 → `count: 0`
- https://marketplace.atlassian.com/rest/2/addons?text=AccessRadar&limit=50&hosting=datacenter → `count: 0`
- https://marketplace.atlassian.com/rest/2/addons?text=access-radar&limit=50 → `count: 0`
- https://marketplace.atlassian.com/rest/2/addons?text=Radar&limit=50 → `count: 26`

**Klucze aplikacji** (`GET /rest/2/addons/{key}`): `accessradar`, `access-radar`, `com.radrly.accessradar`, `com.radrly.access-radar`, `radrly-accessradar`, `accessradar-jira` → wszystkie **404 Not Found**, czyli wolne. Uwaga: klucz aplikacji Forge to UUID z `app.id` (u nas `026c4f6a-266d-4c42-aec5-7394371ad05d`), więc kolizja klucza jest praktycznie niemożliwa. Ten test dotyczy tylko kluczy w stylu Connect/P2.

**Aplikacje z „Radar” w nazwie** (`text=Radar`, wszystkie hostingi; instalacje wg pola `totalInstalls` w wynikach wyszukiwania):
- [Risk Radar for Jira](https://marketplace.atlassian.com/apps/1237030/risk-radar-for-jira-risk-management-assess-track) (200), [Skills radar for Confluence](https://marketplace.atlassian.com/apps/1230867/skills-radar-for-confluence) (29), [TechRadar](https://marketplace.atlassian.com/apps/1214608/techradar) (25), [Skills-Radar for Jira](https://marketplace.atlassian.com/apps/1218488/skills-radar-for-jira) (20)
- [JSM Queue Radar](https://marketplace.atlassian.com/apps/646853047/jsm-queue-radar) (4), [Workload Radar for Jira](https://marketplace.atlassian.com/apps/344194779/workload-radar-for-jira) (3), [Radar - Assets Inventory for JSM](https://marketplace.atlassian.com/apps/974024200/radar-assets-inventory-for-jsm) (3), [Field Radar](https://marketplace.atlassian.com/apps/2298684988/field-radar) (2), [Tech Adoption Radar for Confluence](https://marketplace.atlassian.com/apps/2543668212/tech-adoption-radar-for-confluence) (2)
- **Sąsiednia tematyka adminowa:** [License Radar for Jira](https://marketplace.atlassian.com/apps/2470195860/license-radar-for-jira) (1), [Group Cleanup Radar for Jira](https://marketplace.atlassian.com/apps/3693921448/group-cleanup-radar-for-jira) (1, klucz `net.unitlane.jira.groupimpactaudit`), [Blocked Work Radar](https://marketplace.atlassian.com/apps/3895859387/blocked-work-radar-for-jira) (1), [Stale Radar](https://marketplace.atlassian.com/apps/644575806/stale-radar-untouched-issue-monitor-for-jira) (1), [RiskRadar AI](https://marketplace.atlassian.com/apps/2142281980/riskradar-ai-smart-issue-summaries-risk-detection) (0), [Tech Radar for Compass](https://marketplace.atlassian.com/apps/1237368/tech-radar-for-compass) (0)

Wniosek: „Radar” to popularny sufiks w Marketplace, a w tematyce adminowej najbliżej są *Group Cleanup Radar* i *License Radar*. Ryzyko pomyłki jest umiarkowane. Nikt nie używa „AccessRadar” ani „Access Radar”.

### 1.2 Pełna nazwa: „AccessRadar – Access Review & Permission Audit for Jira”

Szukałem fraz `Access Review & Permission Audit`, `Access Review Permission Audit for Jira`, `Permission Audit for Jira`, `Access Review for Jira` (wszystkie hostingi) i przejrzałem nazwy wszystkich trafień zawierających „access review”, „permission audit”, „access audit” lub „accesslens”. **Żadna nazwa nie jest identyczna.** Bardzo bliskie opisy mają:

| Aplikacja | Nazwa w Marketplace | Podobieństwo |
|---|---|---|
| [AccessLens](https://marketplace.atlassian.com/apps/4182244448/accesslens-permission-audit-access-review-for-jira) | AccessLens — **Permission Audit & Access Review for Jira** | Te same 4 słowa, odwrócona kolejność, myślnik po marce. **Najbliższe** |
| [Clearance](https://marketplace.atlassian.com/apps/2391606881/clearance-for-jira-permission-audit-access-review) | Clearance for Jira (**Permission Audit & Access Review**) | Te same 4 słowa |
| [User Access Review for Jira](https://marketplace.atlassian.com/apps/1273463160/user-access-review-for-jira-permissions-audit) | User Access Review for Jira (Permissions & Audit) | Podobne |
| [Access Review & Audit Trail for Jira](https://marketplace.atlassian.com/apps/147263462/access-review-audit-trail-for-jira) | Access Review & Audit Trail for Jira | „Access Review &” na początku |
| [Permission Audit for Jira](https://marketplace.atlassian.com/apps/3287543305/permission-audit-for-jira) | Permission Audit for Jira | Nasz końcowy człon jest jej całą nazwą |
| [Access Review for Jira](https://marketplace.atlassian.com/apps/2749172492/access-review-for-jira) | Access Review for Jira | j.w. |
| [Group Permission Audit](https://marketplace.atlassian.com/apps/411335795/group-permission-audit-for-jira-access-review-tracking) | Group Permission Audit for Jira (Access Review & Tracking) | Podobne |

**Ocena:** konfliktu nie ma. Opisowe słowa („Access Review”, „Permission Audit”) są generyczne i nikt nie może ich zastrzec. Wyróżnia nas tylko marka „AccessRadar”, a opis zlewa się z 3–4 konkurentami. **Rekomendacja:** zostaw nazwę zalecaną w §1 LISTING.md. Odrzuć Alternatywę A, bo jest prawie kopią AccessLens. Rozważ też Alternatywę B (*AccessRadar: Permission Audit, Snapshots & Sign-off for Jira*, 60/60), bo „Snapshots & Sign-off” nie występuje w żadnej nazwie konkurenta i mówi o naszej przewadze (dowód + podpis).

### 1.3 Poza Marketplace (web)

| Kto | URL | Dziedzina | Ryzyko |
|---|---|---|---|
| **AccessRadar** (WCAG.World): skaner dostępności WCAG, pluginy Shopify i WordPress, plany $0/$39/$129/$399 mies. | https://wcag.world/accessradar · https://www.wcag.world/terms | Dostępność stron (a11y) | Ta sama pisownia, inna kategoria. Konflikt w wyszukiwarce Google („accessradar”). W regulaminie występuje jako nazwa usługi. Nie wiem, czy jest zarejestrowanym znakiem |
| **AccessRadar** (getaccessradar.com): skaner WCAG/EAA, założyciel Brandon Welch | https://www.getaccessradar.com/ · https://linkedin.com/in/brandon-welch-16a4b225b | Dostępność (EAA) | j.w. Możliwe, że to ten sam podmiot co WCAG.World albo powiązany. **Nieustalone** |
| **Vennx Access Radar (VAR)**: IAM/GRC, przeglądy dostępu, SoD, dowody audytowe (SOx, LGPD) | https://vennx.com.br/case/var · https://vennx.com.br/quem-somos | **Ta sama kategoria funkcjonalna** (access review, audyt) | Pisownia ze spacją i prefiksem „Vennx”, rynek brazylijski. **Najwyższe ryzyko merytoryczne**, jeśli mają zarejestrowany znak w klasie 9/42 |
| アクセスレーダー (access-radar.jp): analityka ruchu WWW | http://www.access-radar.jp/tokuteikeiji.html | Web analytics, Japonia | Niskie |

### 1.4 Znaki towarowe (EUIPO / WIPO / USPTO): **NIESPRAWDZONE**

- **EUIPO TMview** (`https://www.tmdn.org/tmview/`): zapytanie przez API (`/tmview/api/search/results`) przekroczyło limit czasu (brak odpowiedzi w 30 s). Wynik nieznany.
- **WIPO Global Brand Database** (`https://branddb.wipo.int/`): strona zwraca CAPTCHA (ALTCHA), więc automatyczne wyszukiwanie jest niemożliwe. Wynik nieznany.
- **USPTO:** nie sprawdzano.
- **Do zrobienia ręcznie (ok. 10 min):** wyszukaj w TMview „ACCESSRADAR” i „ACCESS RADAR” (wszystkie urzędy, klasy nicejskie 9 i 42) oraz to samo w WIPO Brand Database. Sprawdź szczególnie, czy Vennx (Brazylia, INPI) lub WCAG.World mają zgłoszenie. Jeśli tak, w klasie 9/42 to realne ryzyko sprzeciwu, a przed inwestycją w markę warto skonsultować się z rzecznikiem patentowym.

---

## 2. Ceny

### 2.1 Jak naprawdę działają ceny Cloud w Marketplace (zweryfikowane w API)

- **Progi miesięczne są stałe, ustala je Atlassian.** W `perUnitItems` każdej aplikacji występują te same granice: **1–10 (cena płaska), 11–100, 101–250, 251–1 000, 1 001–2 500, 2 501–5 000, 5 001–7 500, 7 501–10 000, 10 001–15 000**, potem co 5 000 do 50 000, co 10 000 do 90 000 i ostatni próg „90 001+” (`unitCount: -1`). Vendor ustala tylko cenę za użytkownika w każdym progu i cenę płaską 1–10. Granic nie zmienia.
- **Model progresywny od 1. użytkownika.** Przy 11+ użytkownikach płacą wszyscy, łącznie z pierwszą dziesiątką: użytkownicy 1–100 po stawce progu 11–100, 101–250 po stawce 101–250 itd. Sprawdziłem to na 26 aplikacjach: cena roczna z API / 10 = suma progresywna. Przykład AuditAdmin, 500 u.: 100×0.45 + 150×0.38 + 250×0.32 = $182/mies., a roczna z API = $1 820. Atlassian opisuje to tak samo dla swoich produktów („$8.60/user for seats 1–100, $7.30/user for seats 101–250…”, https://www.atlassian.com/licensing/cloud).
- **Rocznie = 10× miesięcznie**, ale sprzedawane w **rocznych progach** 10, 15, 25, 50, 100, 200, 300, 400, 500, 600, 800, 1 000, 1 200… Firma z 250 użytkownikami kupuje roczną licencję na 300. Źródło: https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/ („we charge 10 times monthly price as annual price for cloud apps”).
- **Darmowy próg 1–10:** dozwolony (cena płaska $0). Ma go 21 z 26 płatnych aplikacji w tabeli (wyjątki: Project Roles $0.01, Manage Users $2, Access Review (Flowtime) $4, Access Reviewer360 $1.82, Access Evidence $45.25). Wg notatek MarginRadar (§9 jego LISTING) edycja Advanced nie może mieć darmowego progu.
- Zmiany cen wchodzą po 24 h, a obecni klienci mają 60 dni na zakup po starej, niższej cenie (ten sam dokument).

### 2.2 Tabela porównawcza (9.10.2026)

Ceny w USD **za miesiąc** (lista, bez rabatów), wyliczone progresywnie z `perUnitItems`. Kolumna „Rocznie 100 u.” to wartość z API (`items`, `monthsValid: 12`, `unitCount: 100`). Cena roczna przy 250 u. to próg 300, czyli 10× cena miesięczna za 300 u. (patrz `pricing.json`). Instalacje to pole `distribution.totalInstalls` z `/rest/2/addons/{key}`. „brak pola w API” oznacza, że Atlassian go nie zwraca (zwykle przy bardzo nowych aplikacjach). Ocena to `reviews.averageStars` (liczba recenzji).

**Wymienione w zadaniu**

| Aplikacja | Instalacje | Ocena (liczba) | Ceny /user/mies. (11–100 · 101–250 · 251–1000 · 1001–2500) | 10 u. | 50 u. | 100 u. | 250 u. | 500 u. | 1000 u. | Rocznie 100 u. |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| [AccessLens — Permission Audit & Access Review for Jira](https://marketplace.atlassian.com/apps/4182244448/accesslens-permission-audit-access-review-for-jira) | 1 | brak ocen | $0.9 · $0.6 · $0.32 · $0.18 | $0 | $45 | $90 | $180 | $260 | $420 | $900 |
| [Access Lens](https://marketplace.atlassian.com/apps/1328813122/access-lens) | brak pola w API | brak ocen | $0.1 · $0.1 · $0.1 · $0.01 | $0 | $5 | $10 | $25 | $50 | $100 | $100 |
| [Project Access Review for Jira Cloud](https://marketplace.atlassian.com/apps/1238098/project-access-review-for-jira-cloud) | 51 | 5.00★ (1) | darmowa (paymentModel=`free`, `pricing/cloud/live` = 404) | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| [Project Roles - Groups and Users](https://marketplace.atlassian.com/apps/1223088/project-roles-groups-and-users) | 114 | 4.86★ (9) | $0.2 · $0.2 · $0.1 · $0.1 | $0.01 | $10 | $20 | $50 | $75 | $125 | $200 |
| [Access Reviewer360 - Project Access, Roles & Audit for Jira](https://marketplace.atlassian.com/apps/3827910812/access-reviewer360-project-access-roles-audit-for-jira) | 13 | brak ocen | $1.62 · $1.48 · $1.3 · $1.2 | $1.82 | $81 | $162 | $384 | $709 | $1,359 | $1,620 |
| [AuditAdmin for Jira (Access, Users, Groups, Roles & Access)](https://marketplace.atlassian.com/apps/1235391/auditadmin-for-jira-access-users-groups-roles-access) | 9 | 5.00★ (2) | $0.45 · $0.38 · $0.32 · $0.29 | $0 | $22.50 | $45 | $102 | $182 | $342 | $450 |
| [Edit Permission Inheritance](https://marketplace.atlassian.com/apps/1221313/edit-permission-inheritance) | 285 | 3.33★ (3) | $0.22 · $0.16 · $0.11 · $0.05 | $0 | $11 | $22 | $46 | $73.50 | $128.50 | $220 |

**Aplikacje z realną trakcją (admin / audyt / użytkownicy, Jira Cloud)**

| Aplikacja | Instalacje | Ocena (liczba) | Ceny /user/mies. (11–100 · 101–250 · 251–1000 · 1001–2500) | 10 u. | 50 u. | 100 u. | 250 u. | 500 u. | 1000 u. | Rocznie 100 u. |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| [Manage Users for Jira Cloud](https://marketplace.atlassian.com/apps/1224410/manage-users-for-jira-cloud) | 940 | 3.39★ (21) | $0.2 · $0.1 · $0.1 · $0.07 | $2 | $10 | $20 | $35 | $60 | $110 | $200 |
| [User/Group Export & License Optimizer for Jira](https://marketplace.atlassian.com/apps/1220535/user-group-export-license-optimizer-for-jira) | 759 | 4.86★ (18) | $1 · $0.5 · $0.3 · $0.2 | $0 | $50 | $100 | $175 | $250 | $400 | $1,000 |
| [User Management for Jira (bulk & timed inactive users)](https://marketplace.atlassian.com/apps/1215285/user-management-for-jira-bulk-timed-inactive-users) | 752 | 4.80★ (25) | $1 · $0.5 · $0.25 · $0.17 | $0 | $50 | $100 | $175 | $237.50 | $362.50 | $1,000 |
| [User Activity Audit Log](https://marketplace.atlassian.com/apps/1230734/user-activity-audit-log) | 222 | 5.00★ (5) | $1.6 · $1.2 · $0.4 · $0.3 | $0 | $80 | $160 | $340 | $440 | $640 | $1,600 |
| [Doctor Pro: Audit, Optimize & Manage Configuration for Jira](https://marketplace.atlassian.com/apps/1231705/doctor-pro-audit-optimize-manage-configuration-for-jira) | 181 | 5.00★ (10) | $1.8 · $1.1 · $0.6 · $0.35 | $0 | $90 | $180 | $345 | $495 | $795 | $1,800 |
| [Project Role Tab for Jira](https://marketplace.atlassian.com/apps/38661/project-role-tab-for-jira) | 190 | 4.69★ (20) | $0.15 · $0.1 · $0.07 · $0.05 | $0 | $7.50 | $15 | $30 | $47.50 | $82.50 | $150 |

**Pozostali bezpośredni konkurenci (access review / permission audit), znalezieni przy sprawdzaniu nazwy**

| Aplikacja | Instalacje | Ocena (liczba) | Ceny /user/mies. (11–100 · 101–250 · 251–1000 · 1001–2500) | 10 u. | 50 u. | 100 u. | 250 u. | 500 u. | 1000 u. | Rocznie 100 u. |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| [Group Permission Audit for Jira (Access Review & Tracking)](https://marketplace.atlassian.com/apps/411335795/group-permission-audit-for-jira-access-review-tracking) | 3 | brak ocen | $0.65 · $0.24 · $0.13 · $0.11 | $0 | $32.50 | $65 | $101 | $133.50 | $198.50 | $650 |
| [Clearance for Jira (Permission Audit & Access Review)](https://marketplace.atlassian.com/apps/2391606881/clearance-for-jira-permission-audit-access-review) | 1 | brak ocen | $0.8 · $0.5 · $0.3 · $0.13 | $0 | $40 | $80 | $155 | $230 | $380 | $800 |
| [Access Auditor for Jira](https://marketplace.atlassian.com/apps/2492663306/access-auditor-for-jira) | 1 | brak ocen | $0.75 · $0.6 · $0.45 · $0.25 | $0 | $37.50 | $75 | $165 | $277.50 | $502.50 | $750 |
| [Permission Audit for Jira](https://marketplace.atlassian.com/apps/3287543305/permission-audit-for-jira) | 1 | brak ocen | $0.5 · $0.5 · $0.5 · $0.5 | $0 | $25 | $50 | $125 | $250 | $500 | $500 |
| [User Access Review for Jira (Permissions & Audit)](https://marketplace.atlassian.com/apps/1273463160/user-access-review-for-jira-permissions-audit) | brak pola w API | brak ocen | $0.25 · $0.25 · $0.25 · $0.25 | $0 | $12.50 | $25 | $62.50 | $125 | $250 | $250 |
| [Access Review for Jira](https://marketplace.atlassian.com/apps/2749172492/access-review-for-jira) | 2 | brak ocen | $1 · $0.9 · $0.85 · $0.72 | $4 | $50 | $100 | $235 | $447.50 | $872.50 | $1,000 |
| [Recert — Access Reviews for Jira and Confluence](https://marketplace.atlassian.com/apps/2953269953/recert-access-reviews-for-jira-and-confluence) | 1 | brak ocen | $1.25 · $1.25 · $1.25 · $1.25 | $0 | $62.50 | $125 | $312.50 | $625 | $1,250 | $1,250 |
| [Keyring — Access Review & Recertification](https://marketplace.atlassian.com/apps/4088375959/keyring-access-review-recertification) | brak pola w API | brak ocen | $1.36 · $1.15 · $0.96 · $0.87 | $0 | $68 | $136 | $308.50 | $548.50 | $1,028.50 | $1,360 |
| [Access Audit Pro](https://marketplace.atlassian.com/apps/1234045/access-audit-pro) | 1 | 5.00★ (1) | $1.7 · $1.55 · $1.45 · $1.31 | $0 | $85 | $170 | $402.50 | $765 | $1,490 | $1,700 |
| [Access Review & Audit Trail for Jira](https://marketplace.atlassian.com/apps/147263462/access-review-audit-trail-for-jira) | brak pola w API | brak ocen | $2.72 · $2.3 · $1.92 · $1.74 | $0 | $136 | $272 | $617 | $1,097 | $2,057 | $2,720 |
| [Access Audit for Jira](https://marketplace.atlassian.com/apps/1440006727/access-audit-for-jira) | brak pola w API | brak ocen | $3 · $2.6 · $2.2 · $1.85 | $0 | $150 | $300 | $690 | $1,240 | $2,340 | $3,000 |
| [Certia — User Access Reviews for Jira (SOC 2 & ISO 27001)](https://marketplace.atlassian.com/apps/1253836484/certia-user-access-reviews-for-jira-soc-2-iso-27001) | brak pola w API | brak ocen | $4 · $3.5 · $2.5 · $2.5 | $0 | $200 | $400 | $925 | $1,550 | $2,800 | $4,000 |
| [Access Evidence - Access Reviews & Audit Evidence for Jira](https://marketplace.atlassian.com/apps/2440052505/access-evidence-access-reviews-audit-evidence-for-jira) | 1 | brak ocen | $4.53 · $3.83 · $3.2 · $2.9 | $45.25 | $226.50 | $453 | $1,027.50 | $1,827.50 | $3,427.50 | $4,530 |
| [Role Revealer for Jira (Transparency in Roles & Permissions)](https://marketplace.atlassian.com/apps/1231389/role-revealer-for-jira-transparency-in-roles-permissions) | 13 | 4.06★ (4) | $0.15 · $0.07 · $0.03 · $0.01 | $0 | $7.50 | $15 | $25.50 | $33 | $48 | $150 |


**Dla porównania: rodzina Radrly i AccessRadar**

| Plan | 11–100 · 101–250 · 251–1000 · 1001+ | 10 u. | 50 u. | 100 u. | 250 u. | 500 u. | 1000 u. | Rocznie 100 u. |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| MarginRadar Standard (wg agenta MarginRadar / jego LISTING §9) | $0.75 · $0.60 · $0.40 · $0.25 | $0 | $37.50 | $75 | $165 | $265 | $465 | $750 |
| AccessRadar: stara propozycja z LISTING.md §8 (przeliczona poprawnie) | $0.60 · $0.48 · $0.32 · $0.20 | $0 | $30 | $60 | $132 | $212 | $372 | $600 |
| **AccessRadar: rekomendacja (§2.4)** | **$0.75 · $0.55 · $0.35 · $0.20** (dalej $0.15 / $0.12) | **$0** | **$37.50** | **$75** | **$157.50** | **$245** | **$420** | **$750** |

Uwagi do danych:
- **Edit Permission Inheritance** to aplikacja dla **Confluence** (klucz `de.edrup.confluence.plugins.edit-inherit`), nie dla Jira. Uwzględniam ją, bo była na liście. Wyszukiwarka API podaje 339 instalacji, a endpoint aplikacji 285. W tabeli używam 285 (różnica prawdopodobnie wynika z sumowania hostingów; **nie wyjaśnione**).
- **Project Access Review (Akeles):** `versions/latest` zwraca `paymentModel: free`, a `pricing/cloud/live` zwraca 404, więc aplikacja jest darmowa.
- **Project Roles (Bloompeak)** ma cenę płaską dla 1–10 = $0.01/mies. ($0.10/rok), czyli formalnie nie $0.
- **Access Lens (Gluebin):** $0.10/user do 1 000 u., potem $0.01. API nie zwraca liczby instalacji.
- Wszystkie aplikacje w tabeli mają `paymentModel: atlassian` (Paid via Atlassian), poza Akeles (`free`).
- Instalacje są zaokrąglane przez Atlassian i nie mówią nic o przychodach. Ocena to średnia z niewielu recenzji.

### 2.3 Co wynika z danych

1. **Bezpośredni konkurenci (19 płatnych aplikacji access review / permission audit dla Jira; Akeles jest darmowa):** cena za 100 u./rok od $100 do $4 530, **mediana $900**. Wśród aplikacji robiących pełny przegląd z podpisem/dowodem (AccessLens, Access Reviewer360, Access Evidence, Clearance, Certia, Recert, Keyring, User Access Review, Access Review (Flowtime), Access Review & Audit Trail, Group Permission Audit) mediana to **$1 250**.
2. **Trakcja nie zależy od ceny.** Najtańsze (Access Lens $100) i najdroższe (Access Evidence $4 530, Certia $4 000) mają po 0–1 instalacji. Najwięcej instalacji w niszy mają **proste i tanie** narzędzia: Project Roles 114 ($200), Akeles 51 (darmowe), Role Revealer 13, Access Reviewer360 13. 15 z 19 płatnych ma 0–3 instalacje albo API nie podaje ich liczby, a większość wypuściła ostatnią wersję w lipcu–październiku 2026. Nisza jest tłoczna i aktywna, ale nikt jej nie wygrał.
3. **Aplikacje adminowe z trakcją** (User/Group Export 759, User Management TechTime 752) biorą **$1.00/user** w progu 11–100 i mocno obniżają cenę wyżej (1 000 u. = $362–400/mies.). Manage Users (940) jest tani ($0.20), ale ma ocenę 3.39★. Rynek akceptuje około $1 000/rok za 100 u. za narzędzie adminowe, które ma recenzje.
4. **Kupujący compliance** (SOC 2 / ISO 27001) to zwykle firmy 100–1 000+ użytkowników. Kluczowe są więc progi 101–250 i 251–1 000. Przy 500 u. konkurenci kosztują rocznie: GPA $1 335, AuditAdmin $1 820, Clearance $2 300, AccessLens $2 600, Access Auditor $2 775.

### 2.4 Propozycja dla AccessRadar (PROPOZYCJA, nie decyzja)

| Próg (miesięcznie, progresywnie) | Standard | Uzasadnienie |
|---|---:|---|
| 1–10 | **$0** (płasko) | Z briefu. Admin może przetestować na sandboxie lub małej instancji, a darmowy próg zbiera instalacje i recenzje, które dziś są najważniejszą przewagą |
| 11–100 | **$0.75** | Jak MarginRadar (spójność marki Radrly). Daje $750/rok za 100 u.: poniżej mediany niszy ($900) i mediany pełnych narzędzi do przeglądów ($1 250), a powyżej mikroklonów ($100–500), żeby nie sygnalizować „zabawki” kupującemu z budżetem compliance |
| 101–250 | **$0.55** | Między AccessLens ($0.60) a AuditAdmin ($0.38). Lekko poniżej MarginRadar ($0.60), bo access review kupuje się raz na kwartał, a nie używa codziennie |
| 251–1 000 | **$0.35** | Konkurencyjne przy 500 u. ($2 450/rok wobec AccessLens $2 600 i Access Auditor $2 775) |
| 1 001–2 500 | **$0.20** | Duże instancje: koszt Forge SQL nieznany (spec tydz. 7), więc nie schodzę niżej |
| 2 501–5 000 | **$0.15** | j.w. |
| 5 001+ (wszystkie wyższe progi) | **$0.12** | Atlassian wymaga ceny w każdym progu do 90 001+ |
| Rocznie | 10× miesięcznie (automatycznie), w progach rocznych | — |
| Trial | 30 dni | Standard Cloud |

Wyliczenia (progresywnie, miesięcznie): 25 u. **$18.75** · 50 u. **$37.50** · 100 u. **$75** (rocznie $750) · 250 u. **$157.50** (roczna licencja w progu 300: $1 750) · 500 u. **$245** (rocznie $2 450) · 1 000 u. **$420** (rocznie $4 200) · 2 500 u. **$720**.

**Warianty do decyzji:**
- **Niski** ($0.50 / $0.40 / $0.28 / $0.16 / $0.12 / $0.10): 100 u. = $500/rok. Szybsze pierwsze sprzedaże, ale trudno potem podnieść cenę (obecni klienci mają 60 dni po starej cenie, a ruchy cenowe widać w Marketplace). Wybierz ten wariant, jeśli priorytetem są instalacje i recenzje.
- **Premium** ($0.99 / $0.75 / $0.45 / $0.25 / $0.18 / $0.14): 100 u. = $990/rok, poziom AccessLens i narzędzi adminowych z trakcją. Ma sens dopiero, gdy będzie gotowy PDF evidence pack i pierwsze recenzje.
- **Moja rekomendacja:** wariant środkowy na start. Rewizja po 3 miesiącach albo po 10 płatnych instalacjach (co nastąpi pierwsze), plus pomiar kosztu Forge SQL na dużej instancji.

Czego **nie wiem** i nie zgaduję: konwersji trial→paid w tej niszy, przychodów konkurentów (API ich nie podaje) ani kosztu Forge po naszej stronie dla 1 000+ użytkowników.

**Do poprawy w LISTING.md §8:** stawki (jeśli przyjmiesz rekomendację) i przykłady. Stare przykłady są policzone błędnie, bo liczą płatność od 11. użytkownika. Poprawnie dla starej propozycji wychodzi: 25 u. $15.00 · 50 u. $30.00 · 100 u. $60.00 (= $600/rok) · 250 u. $132.00 · 500 u. $212.00. W notce PL w §8 trzeba też zaktualizować punkty odniesienia (Access Reviewer360 $1 620 i AccessLens $900 są aktualne; dochodzą Clearance $800, Access Auditor $750, Recert $1 250, Keyring $1 360, Certia $4 000, Access Evidence $4 530).

---

## 3. Pytania prawne i prywatność (LISTING.md §9, pozycje [TO CONFIRM])

Każde pytanie to prosta decyzja dla Ciebie. Rekomendacje opierają się na tym, co kod **faktycznie** robi dziś (stan `/workspace/accessradar` 9.10.2026).

### 3.1 Pytania

**P1. Czy aplikacja zapisuje dane użytkowników końcowych w logach?** (*Logs End-User Data?*, w LISTING: „No [TO CONFIRM]”)
- **Co to znaczy:** czy w logach Forge (konsola developera, Atlassian je przechowuje, a admin klienta może je pobrać) trafiają dane klienta: accountId, nazwy osób, nazwy grup lub projektów, treści.
- **Co robi kod:** produkcyjne logi (`src/collector/run.ts`, `src/handlers.ts`, `src/api/service.ts`) zawierają tylko numery snapshotów, nazwy kroków, liczniki, czasy i fragment hasha recenzji. **Nie ma** w nich accountId, e-maili ani nazw osób. Są jednak dwa wyjątki: (a) przy błędach logujemy treść błędu z Jiry (do 200–300 znaków, np. `Project list unreadable (403): <komunikat Jiry>`), a komunikaty Jiry mogą czasem zawierać identyfikatory lub nazwy; (b) kod „spike” (`src/spike/probe.ts`, `formatProbeLog`) loguje pełne wyniki sond. Działa tylko przy `ACCESSRADAR_SPIKE=1` i w środowisku DEVELOPMENT, ale jest w buildzie.
- **Rekomendacja:** **„No”**, pod warunkiem że przed submitem (1) błędy Jiry logujemy jako sam kod statusu i nazwę obszaru, bez treści komunikatu, oraz (2) usuniemy kod spike z buildu produkcyjnego albo potwierdzimy, że zmienna nie istnieje w produkcji. Bez tych poprawek uczciwa odpowiedź to **„Yes: limited, logs stay in Atlassian (Forge logs, 30 days)”**.
- **Ryzyko:** „No” bez poprawek grozi niezgodnością deklaracji z działaniem (recenzja Atlassian, utrata zaufania przy audycie bezpieczeństwa klienta). „Yes” jest uczciwe, ale część zespołów bezpieczeństwa zada dodatkowe pytania. Prawnik: **nie potrzebny** (to kwestia techniczna).

**P2. Czy dane zostają po odinstalowaniu i jak długo?** (w LISTING: „Yes: min 0, max 28 days [TO CONFIRM]”)
- **Co to znaczy:** co dzieje się z danymi w Forge SQL po odinstalowaniu aplikacji.
- **Co robi kod:** nie ma modułu `preUninstall`, więc nic nie kasujemy sami. Dane leżą wyłącznie w Forge SQL (Atlassian).
- **Fakty z dokumentacji:** „Forge hosted storage retains data for 28 days after uninstallation” (https://developer.atlassian.com/platform/forge/storage-reference/). Uwaga: inne strony Atlassian podają „up to 30 days” (Forge Quest) albo okres „as outlined in the Atlassian SOC 2 report” (https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/). Dokumentacja jest niespójna.
- **Rekomendacja:** **„Yes: min 0, max 28 days”**, z dopiskiem w /security: „deleted by Atlassian per Forge hosted-storage lifecycle; Radrly keeps no copy”. Opcjonalnie dodaj `preUninstall`, który czyści tabele. Atlassian i tak trzyma kopię soft-deleted, więc odpowiedź się nie zmieni.
- **Ryzyko:** niskie. Jeśli Atlassian faktycznie trzyma 30 dni, nasza deklaracja 28 dni będzie lekko nieścisła, ale zgodna z ich główną stroną referencyjną. Prawnik: **nie potrzebny**.

**P3. Jak opisać techniki ochrony prywatności?** (*Privacy-enhancing technologies*, w LISTING: „data minimisation… anonymisation of closed accounts [TO CONFIRM wording]”)
- **Co to znaczy:** jakie techniki ograniczają ilość lub identyfikowalność danych osobowych.
- **Co robi kod:** brak e-maili (potwierdzone: `rg email src` = 0 trafień). Klucz to accountId. Raz dziennie wołamy `privacy.reportPersonalData`. Dla zamkniętych kont `anonymize()` (`src/privacy.ts`) zastępuje **tylko display name** pseudonimem `Closed account <8 znaków SHA-256(accountId)>` w tabelach `fact` i `stage`. **accountId zostaje** w `fact`, `review_item.subject_id`, `review_item.decided_by`, `review.created_by/signed_by` i `audit_event.actor`. Notatki recenzentów (`review_item.note`, wolny tekst) i `attestation` nie są czyszczone.
- **Rekomendacja:** pisz **„Data minimisation and pseudonymisation”**, a nie „anonymisation”. Prawnie to pseudonimizacja, bo accountId nadal identyfikuje osobę pośrednio.
- **Ryzyko:** słowo „anonymisation” byłoby nieprawdziwe. Prawnik: **nie do sformułowania, ale tak do P3a** (niżej).

**P3a (nowe, wynika z kodu). Czy po zamknięciu konta możemy zatrzymać accountId w dowodach audytowych?**
- **Co to znaczy:** Atlassian wymaga: „If your app stores the personal data for a user and the user requests for their data to be erased, your app must erase the data” (https://developer.atlassian.com/platform/forge/user-privacy-guidelines/). accountId jest daną osobową wg Atlassian.
- **Konflikt:** recenzja z podpisem ma hash SHA-256 liczony z pozycji (w tym accountId). Usunięcie accountId złamie weryfikację hasha starszych dowodów.
- **Opcje:** (A) zamieniać accountId na pseudonim także w `fact`, `review_item`, `audit_event`, a w dowodzie oznaczyć „subject erased after sign-off”, wtedy hash przestaje się zgadzać; (B) zachować accountId w podpisanych recenzjach jako niezbędne dla obowiązku dowodowego klienta (art. 17 ust. 3 lit. b/e RODO), a usuwać wszędzie indziej; (C) zostawić jak jest.
- **Rekomendacja:** **B**, po potwierdzeniu przez prawnika i z opisem w DPA. Plus czyszczenie notatek wolnotekstowych lub ostrzeżenie w UI („don't write personal data here”).
- **Ryzyko:** C = realne ryzyko naruszenia wymagań Atlassian (Data Security & Privacy Statement) i RODO. A = utrata wartości dowodowej. Prawnik: **TAK**.

**P4. Czy Radrly jest administratorem (controller) danych w rozumieniu RODO?** (w LISTING: „No [LEGAL TO CONFIRM]”)
- **Co to znaczy:** administrator decyduje o celach i sposobach przetwarzania. W aplikacji robi to klient: to on włącza snapshoty, ustawia retencję i prowadzi przegląd.
- **Co robi kod:** dane nie opuszczają Atlassian. Brak `permissions.external` i Forge Remote w `manifest.yml`. Radrly nie ma dostępu do danych klienta.
- **Rekomendacja:** **„No” dla danych w aplikacji.** Radrly jest administratorem tylko własnych danych biznesowych (kontakty licencyjne z Marketplace, zgłoszenia supportowe, marcin@radrly.com). To powinno być w Privacy Policy, a nie w tej odpowiedzi.
- **Ryzyko:** niskie przy „No”. Prawnik: **TAK, razem z P5** (jeden komplet: Privacy Policy + DPA).

**P5. Czy Radrly jest podmiotem przetwarzającym (processor)?** (w LISTING: „Yes [LEGAL TO CONFIRM]”)
- **Co to znaczy:** przetwarzanie danych osobowych w imieniu klienta.
- **Argumenty:** Radrly określa logikę przetwarzania (kod), dane są w infrastrukturze, którą Radrly wybrało (Forge), a support może dostać od klienta eksport CSV/PDF z danymi osobowymi. Kontrargument: Radrly technicznie nie ma dostępu do danych w Forge SQL.
- **Rekomendacja:** **„Yes”**, z DPA na /dpa i z Atlassian jako sub-procesorem (hosting Forge). To bezpieczniejsza i typowa odpowiedź w Marketplace (tak samo jak w MarginRadar). Zespoły zakupowe compliance i tak poproszą o DPA.
- **Ryzyko:** „Yes” zobowiązuje do DPA, rejestru czynności przetwarzania (art. 30 ust. 2) i procedury naruszeń (72 h przez klienta). „No” przy jednoczesnym przyjmowaniu eksportów w supporcie może okazać się nieprawdą. Prawnik: **TAK** (treść DPA, lista sub-procesorów, czy Atlassian jest sub-procesorem Radrly, czy procesorem klienta bezpośrednio).

**P6. CCPA (Kalifornia)** (w LISTING: „Not applicable / No [LEGAL TO CONFIRM]”)
- **Co to znaczy:** CCPA dotyczy „businesses” powyżej progów (m.in. przychód > ok. $25 mln, kwota indeksowana; **progów nie weryfikowałem dziś**) oraz ich „service providers”.
- **Rekomendacja:** **Business: No. Service provider: Yes** (jeśli klient z Kalifornii jest „business”, my działamy jako jego usługodawca na tych samych zasadach co w DPA). Nie sprzedajemy ani nie udostępniamy danych.
- **Ryzyko:** niskie. Pomyłka w tę stronę (deklaracja service provider) niczego nie kosztuje poza zapisem w DPA. Prawnik: **TAK, krótko** (jedna klauzula w DPA/Terms).

**P7. Czy dane z EOG są przekazywane poza EOG?** (w LISTING: „No [TO CONFIRM]”)
- **Co to znaczy:** transfer danych do państw trzecich (np. USA).
- **Fakty:** „Every Forge-hosted persistent storage capability is data residency-enabled. Data an app stores in … Forge SQL … is held in the same location as the host Atlassian app” (https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/). Radrly (Polska, EOG) nie pobiera danych. Ale: klient **bez** przypiętej rezydencji danych może mieć Jirę (a więc i nasze dane) w regionie poza EOG, a obsługa Forge (funkcje, logi) to infrastruktura Atlassian.
- **Rekomendacja:** **„No, Radrly does not transfer data. Storage follows the customer's Atlassian data residency; Atlassian's own transfers are covered by Atlassian's DPA.”**
- **Ryzyko:** samo „No” może być nieścisłe dla klientów bez rezydencji w UE (transfer robi wtedy Atlassian, nie my). Prawnik: **TAK** (czy wymieniamy Atlassian jako sub-procesora z SCC).

### 3.2 Które wymagają prawnika

| Pytanie | Prawnik? | Dlaczego |
|---|---|---|
| P1 Logi | Nie | Techniczne: poprawić kod i odpowiedzieć zgodnie z prawdą |
| P2 Po odinstalowaniu | Nie | Fakt z dokumentacji Atlassian |
| P3 Sformułowanie PET | Nie | Wystarczy zmienić „anonymisation” na „pseudonymisation” |
| **P3a accountId po zamknięciu konta** | **Tak** | Konflikt prawa do usunięcia z wartością dowodową (art. 17 ust. 3 RODO) oraz wymaganiami Atlassian |
| **P4 + P5 Administrator/procesor** | **Tak** | Rola Radrly, treść DPA, sub-procesorzy |
| **P6 CCPA** | **Tak (krótko)** | Klauzula service provider |
| **P7 Transfer poza EOG** | **Tak** | Atlassian jako sub-procesor, SCC |

Rozsądny zakres zlecenia dla prawnika (RODO/IT): **Privacy Policy + DPA + Terms (EULA) dla AccessRadar i MarginRadar razem** (ten sam vendor, ta sama architektura Forge) plus opinia do P3a. Kosztów i terminów nie szacuję (brak danych).

### 3.3 Rzeczy z kodu do poprawy przed submitem (nie prawne, ale wpływają na odpowiedzi)

1. **Raport danych osobowych codziennie, a Atlassian każe co 7 dni.** `accessradar-privacy-daily` (interval: day) zgłasza **wszystkie** accountId codziennie, łącznie z już zanonimizowanymi zamkniętymi kontami. Atlassian: „You should not send reports more frequently than the cycle period for each accountId” (domyślnie 7 dni, nagłówek `Cycle-Period`) oraz „our systems will detect the case of apps repeatedly checking the status of a closed account”. Poprawka: zapisywać datę ostatniego raportu per accountId, respektować `Cycle-Period` i nie raportować kont już zamkniętych.
2. **Status `updated` jest tylko liczony** (`runPrivacyReport`), a display name nie jest odświeżany. Atlassian wymaga aktualizacji lub usunięcia danych. W praktyce następny snapshot (domyślnie co tydzień) odświeży nazwę, ale stare wersje w `fact` zostaną. Do decyzji: czy to wystarczy (prawdopodobnie tak, jeśli opiszemy to w /security).
3. **`audit_event` nie ma retencji** (nie czyści go `applyRetention`), a recenzje są trzymane „until uninstall”. To zgodne z LISTING §9, ale warto opisać w DPA.
4. **Impersonacja** (`allowImpersonation: true`): używana tylko, gdy admin w Ustawieniach wybierze „fallback = me” (`src/api/service.ts:606–608`, accountId brany z kontekstu serwera, nie od klienta). Ujawnienie w LISTING §9 jest prawidłowe. Decyzja „zostawić czy usunąć” nadal należy do Ciebie (LISTING §11 pkt 4).
5. **Rezydencja danych:** potwierdzona w dokumentacji (Forge SQL jest residency-enabled, link w P7). Wiersz „Data residency” w LISTING §9 jest OK.

---

## 4. Źródła (9.10.2026)
- Marketplace REST: `https://marketplace.atlassian.com/rest/2/addons?text=…` (URL-e wszystkich zapytań w `research-raw/name-search-summary.json`), `/rest/2/addons/{key}`, `/rest/2/addons/{key}/versions/latest?hosting=cloud`, `/rest/2/addons/{key}/pricing/cloud/live` (`research-raw/pricing.json`).
- Pricing, payment and billing: https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/
- Atlassian Cloud licensing (model progresywny): https://www.atlassian.com/licensing/cloud
- Forge storage (28 dni po odinstalowaniu): https://developer.atlassian.com/platform/forge/storage-reference/
- Forge hosted storage data lifecycle + rezydencja: https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/
- User privacy guide (raportowanie, cykl 7 dni, erasure): https://developer.atlassian.com/platform/forge/user-privacy-guidelines/
- Logging guidelines (AaID: „log with caution”): https://developer.atlassian.com/platform/forge/logging-guidelines/
- Nazwa poza Marketplace: https://wcag.world/accessradar · https://www.getaccessradar.com/ · https://vennx.com.br/case/var · http://www.access-radar.jp/tokuteikeiji.html
- Znaki towarowe (niesprawdzone, próba): https://www.tmdn.org/tmview/ (timeout API) · https://branddb.wipo.int/ (CAPTCHA)

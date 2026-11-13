# AccessRadar: aktualny cennik (raport z 2026-10-30)

Aplikacja: AccessRadar (Atlassian Marketplace app id 3691498947, klucz Forge `026c4f6a-266d-4c42-aec5-7394371ad05d`).
Listing: https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira
Strona: https://accessradar.radrly.com

Raport przygotowany wyłącznie na podstawie odczytów (GET). Niczego nie zmieniałem w Marketplace, w panelu partnera, na stronie ani w kodzie. Wszystkie godziny podaję w czasie warszawskim (CET, UTC+1). Ceny są w USD.

Oznaczenia przy liczbach:
- **[LIVE ✔ 2026-10-30]**: sprawdzone dziś w publicznym listingu Marketplace (dane `__INITIAL_STATE__` strony, kraj PL) i/lub w API vendora.
- **[STRONA ✔ 2026-10-30]**: sprawdzone dziś na https://accessradar.radrly.com.
- **[NOTATKA]**: decyzja zapisana w notatkach Marcina, bez potwierdzenia w zewnętrznym źródle.
- **[REPO]**: dokument w repozytorium `/workspace/accessradar` (branch podany przy cytacie).

## W skrócie

- Obie edycje (Standard i Advanced) są **LIVE** w Marketplace. Atlassian zatwierdził edycje 2026-10-27 o 11:52 CET (`approvalTimestamp` w listingu). Ostatnia zmiana cen w panelu: 2026-10-28 15:42 CET (`lastModified` w API v2).
- Ceny LIVE są **identyczne** z decyzją Marcina z 2026-10-23 (b) i z cennikiem na stronie. Brak różnic.
- W API v2 wersja `pending` jest identyczna z `live`. Nie ma żadnych cen czekających na publikację.
- Cena roczna = 10 x miesięczna: potwierdzone dla wszystkich 84 progów rocznych w obu edycjach, zero odchyleń.
- Trial 30 dni: deklarowany na stronie i w dokumentacji. Publiczne dane Marketplace nie podają długości triala, a endpoint Commerce z polem `trial.lengthDays` zwrócił 401, więc w Marketplace tego nie potwierdziłem.
- Główne rozbieżności dotyczą dokumentów w repo (stare ceny z 10-10 i 10-14) i notatki 2026-10-23 (a) (Advanced "jak w MarginRadar"). Szczegóły w sekcji Rozbieżności.

## 1. Ceny LIVE (miesięcznie, chmura)

Rozliczenie jest progresywne od pierwszego użytkownika: po przekroczeniu 10 użytkowników płaci się stawkę progu za każdego użytkownika, licząc od pierwszego (np. 11 użytkowników w Standard = 11 x $0.75 = $8.25).

| Próg użytkowników | Standard | Advanced | Źródło |
|---|---|---|---|
| 1-10 (darmowy / płaski) | **$0** (darmowo) | **$4 płasko** za całą instancję | [LIVE ✔ 2026-10-30] [STRONA ✔ 2026-10-30] |
| 11-100 | **$0.75** / użytk. | **$1.49** / użytk. | [LIVE ✔ 2026-10-30] [STRONA ✔ 2026-10-30] |
| 101-250 | **$0.55** | **$0.99** | [LIVE ✔ 2026-10-30] [STRONA ✔ 2026-10-30] |
| 251-1 000 | **$0.35** | **$0.99** | [LIVE ✔ 2026-10-30] [STRONA ✔ 2026-10-30] |
| 1 001-2 500 | **$0.20** | **$0.49** | [LIVE ✔ 2026-10-30] [STRONA ✔ 2026-10-30] |
| 2 501-5 000 | **$0.15** | **$0.49** | [LIVE ✔ 2026-10-30] [STRONA ✔ 2026-10-30] |
| 5 001 i więcej (do 150 000 w listingu, strona pisze "5,001-100,000") | **$0.12** | **$0.49** | [LIVE ✔ 2026-10-30] [STRONA ✔ 2026-10-30] |

Darmowy poziom: tylko Standard (do 10 użytkowników za $0). Advanced nie ma darmowego poziomu, za 1-10 użytkowników kosztuje $4 miesięcznie płasko.

Przykładowe rachunki miesięczne (wyliczone z cen LIVE; przykłady ze strony się zgadzają):

| Użytkownicy | Standard / mies. | Advanced / mies. |
|---|---|---|
| 10 | $0 | $4 |
| 11 | $8.25 | $16.39 |
| 25 | $18.75 | $37.25 |
| 50 | $37.50 | $74.50 |
| 100 | $75 | $149 |
| 250 | $157.50 | $297.50 |
| 500 | $245 | $545 |
| 1 000 | $420 | $1 040 |
| 2 000 | $620 | $1 530 |
| 5 000 | $1 095 | $3 000 |

Pełna tabela progów miesięcznych z listingu (obie edycje) [LIVE ✔ 2026-10-30]:

#### Miesięcznie (listing, obie edycje)

| Próg (użytkownicy) | Standard | Advanced |
|---|---|---|
| 1-10 | $0 płasko | $4 płasko |
| 11-100 | $0.75 / użytk. | $1.49 / użytk. |
| 101-250 | $0.55 / użytk. | $0.99 / użytk. |
| 251-1 000 | $0.35 / użytk. | $0.99 / użytk. |
| 1 001-2 500 | $0.20 / użytk. | $0.49 / użytk. |
| 2 501-5 000 | $0.15 / użytk. | $0.49 / użytk. |
| 5 001-7 500 | $0.12 / użytk. | $0.49 / użytk. |
| 7 501-10 000 | $0.12 / użytk. | $0.49 / użytk. |
| 10 001-15 000 | $0.12 / użytk. | $0.49 / użytk. |
| 15 001-20 000 | $0.12 / użytk. | $0.49 / użytk. |
| 20 001-25 000 | $0.12 / użytk. | $0.49 / użytk. |
| 25 001-30 000 | $0.12 / użytk. | $0.49 / użytk. |
| 30 001-35 000 | $0.12 / użytk. | $0.49 / użytk. |
| 35 001-40 000 | $0.12 / użytk. | $0.49 / użytk. |
| 40 001-45 000 | $0.12 / użytk. | $0.49 / użytk. |
| 45 001-50 000 | $0.12 / użytk. | $0.49 / użytk. |
| 50 001-60 000 | $0.12 / użytk. | $0.49 / użytk. |
| 60 001-70 000 | $0.12 / użytk. | $0.49 / użytk. |
| 70 001-80 000 | $0.12 / użytk. | $0.49 / użytk. |
| 80 001-90 000 | $0.12 / użytk. | $0.49 / użytk. |
| 90 001-150 000 | $0.12 / użytk. | $0.49 / użytk. |


## 2. Ceny roczne i trial

- **Roczne = 10 x miesięczne** [LIVE ✔ 2026-10-30]. Sprawdziłem wszystkie 84 progi roczne obu edycji: każdy próg roczny = 10 x miesięczny koszt dla górnej granicy progu. Zero odchyleń. Dla Standard roczne kwoty z API v2 (`items`, `monthsValid` 12) są identyczne z listingiem (84/84).
- Licencje roczne sprzedaje się w progach (10, 15, 25, 50, 100, 200, 300, 400, 500...). Firma z 250 użytkownikami kupuje próg 300.
- Przykłady rocznie: 100 użytk. Standard $750, Advanced $1 490; 200 użytk. $1 300 / $2 480; 300 użytk. $1 750 / $3 470; 500 użytk. $2 450 / $5 450; 1 000 użytk. $4 200 / $10 400.
- Do 10 użytkowników rocznie: Standard $0, Advanced $40.
- **Trial: 30 dni** wg strony ("Two editions, both with a 30-day free trial.") [STRONA ✔ 2026-10-30] i wg `docs/LISTING.md` [REPO, local main i origin/main]. Listing pokazuje przyciski "Start free trial" i FAQ "Can I extend my free trial?", ale **nie podaje liczby dni**. Endpoint Commerce `GET /commerce/api/v3/offerings/{id}` (pole `trial.lengthDays`) zwrócił **401 Unauthorized**, więc długości triala w Marketplace nie potwierdziłem. 30 dni to standard Atlassian dla aplikacji chmurowych, ale traktuję to jako niezweryfikowane w API.

Pełna tabela progów rocznych z listingu (kwota za cały próg na rok) [LIVE ✔ 2026-10-30]:

#### Rocznie (listing, cena za cały próg roczny, obie edycje)

| Próg roczny | Standard | Advanced |
|---|---|---|
| 1-10 | $0.00 | $40.00 |
| 11-15 | $112.50 | $223.50 |
| 16-25 | $187.50 | $372.50 |
| 26-50 | $375.00 | $745.00 |
| 51-100 | $750.00 | $1 490.00 |
| 101-200 | $1 300.00 | $2 480.00 |
| 201-300 | $1 750.00 | $3 470.00 |
| 301-400 | $2 100.00 | $4 460.00 |
| 401-500 | $2 450.00 | $5 450.00 |
| 501-600 | $2 800.00 | $6 440.00 |
| 601-800 | $3 500.00 | $8 420.00 |
| 801-1 000 | $4 200.00 | $10 400.00 |
| 1 001-1 200 | $4 600.00 | $11 380.00 |
| 1 201-1 400 | $5 000.00 | $12 360.00 |
| 1 401-1 600 | $5 400.00 | $13 340.00 |
| 1 601-1 800 | $5 800.00 | $14 320.00 |
| 1 801-2 000 | $6 200.00 | $15 300.00 |
| 2 001-2 250 | $6 700.00 | $16 525.00 |
| 2 251-2 500 | $7 200.00 | $17 750.00 |
| 2 501-2 750 | $7 575.00 | $18 975.00 |
| 2 751-3 000 | $7 950.00 | $20 200.00 |
| 3 001-3 250 | $8 325.00 | $21 425.00 |
| 3 251-3 500 | $8 700.00 | $22 650.00 |
| 3 501-3 750 | $9 075.00 | $23 875.00 |
| 3 751-4 000 | $9 450.00 | $25 100.00 |
| 4 001-4 250 | $9 825.00 | $26 325.00 |
| 4 251-4 500 | $10 200.00 | $27 550.00 |
| 4 501-4 750 | $10 575.00 | $28 775.00 |
| 4 751-5 000 | $10 950.00 | $30 000.00 |
| 5 001-5 500 | $11 550.00 | $32 450.00 |
| 5 501-6 000 | $12 150.00 | $34 900.00 |
| 6 001-6 500 | $12 750.00 | $37 350.00 |
| 6 501-7 000 | $13 350.00 | $39 800.00 |
| 7 001-7 500 | $13 950.00 | $42 250.00 |
| 7 501-8 000 | $14 550.00 | $44 700.00 |
| 8 001-8 500 | $15 150.00 | $47 150.00 |
| 8 501-9 000 | $15 750.00 | $49 600.00 |
| 9 001-9 500 | $16 350.00 | $52 050.00 |
| 9 501-10 000 | $16 950.00 | $54 500.00 |
| 10 001-11 000 | $18 150.00 | $59 400.00 |
| 11 001-12 000 | $19 350.00 | $64 300.00 |
| 12 001-13 000 | $20 550.00 | $69 200.00 |
| 13 001-14 000 | $21 750.00 | $74 100.00 |
| 14 001-15 000 | $22 950.00 | $79 000.00 |
| 15 001-16 000 | $24 150.00 | $83 900.00 |
| 16 001-17 000 | $25 350.00 | $88 800.00 |
| 17 001-18 000 | $26 550.00 | $93 700.00 |
| 18 001-19 000 | $27 750.00 | $98 600.00 |
| 19 001-20 000 | $28 950.00 | $103 500.00 |
| 20 001-21 000 | $30 150.00 | $108 400.00 |
| 21 001-22 000 | $31 350.00 | $113 300.00 |
| 22 001-23 000 | $32 550.00 | $118 200.00 |
| 23 001-24 000 | $33 750.00 | $123 100.00 |
| 24 001-25 000 | $34 950.00 | $128 000.00 |
| 25 001-26 000 | $36 150.00 | $132 900.00 |
| 26 001-27 000 | $37 350.00 | $137 800.00 |
| 27 001-28 000 | $38 550.00 | $142 700.00 |
| 28 001-29 000 | $39 750.00 | $147 600.00 |
| 29 001-30 000 | $40 950.00 | $152 500.00 |
| 30 001-31 000 | $42 150.00 | $157 400.00 |
| 31 001-32 000 | $43 350.00 | $162 300.00 |
| 32 001-33 000 | $44 550.00 | $167 200.00 |
| 33 001-34 000 | $45 750.00 | $172 100.00 |
| 34 001-35 000 | $46 950.00 | $177 000.00 |
| 35 001-36 000 | $48 150.00 | $181 900.00 |
| 36 001-37 000 | $49 350.00 | $186 800.00 |
| 37 001-38 000 | $50 550.00 | $191 700.00 |
| 38 001-39 000 | $51 750.00 | $196 600.00 |
| 39 001-40 000 | $52 950.00 | $201 500.00 |
| 40 001-41 000 | $54 150.00 | $206 400.00 |
| 41 001-42 000 | $55 350.00 | $211 300.00 |
| 42 001-43 000 | $56 550.00 | $216 200.00 |
| 43 001-44 000 | $57 750.00 | $221 100.00 |
| 44 001-45 000 | $58 950.00 | $226 000.00 |
| 45 001-46 000 | $60 150.00 | $230 900.00 |
| 46 001-47 000 | $61 350.00 | $235 800.00 |
| 47 001-48 000 | $62 550.00 | $240 700.00 |
| 48 001-49 000 | $63 750.00 | $245 600.00 |
| 49 001-50 000 | $64 950.00 | $250 500.00 |
| 50 001-60 000 | $76 950.00 | $299 500.00 |
| 60 001-70 000 | $88 950.00 | $348 500.00 |
| 70 001-80 000 | $100 950.00 | $397 500.00 |
| 80 001-90 000 | $112 950.00 | $446 500.00 |
| 90 001-100 000 | $124 950.00 | $495 500.00 |


## 3. Funkcje w edycjach

### Marketplace (listing LIVE) [LIVE ✔ 2026-10-30]

**Standard:**
- Permission explorer
- Snapshots and diffs (ręczne i co tydzień)
- Access reviews (Keep / Revoke / Exception)
- Weekly digest

**Advanced** ("Everything from Standard, plus"):
- Custom schedules
- Unlimited history (ponad 90 dni)
- Remediation verification
- Delegated reviews (właściciele projektów, z przypomnieniami)
- Review campaigns
- Real-time alerts (nowi admini, publiczne uprawnienia, nieaktywni użytkownicy, reguły alertów)
- Evidence pack (podpisany PDF)
- Rovo agent (tylko odczyt)
- Signed reviews and Verify (łańcuch hashy odporny na manipulację)

Wniosek: mapowanie funkcji wysłane po 2026-10-27 (Weekly digest w Standard, Signed reviews and Verify w Advanced, "Change alerts" przemianowane na "Real-time alerts") jest **już LIVE** w listingu. Ceny przy tym się nie zmieniły.

### Strona accessradar.radrly.com [STRONA ✔ 2026-10-30]

Sekcja cennika na żywej stronie jest identyczna z kopią w `/workspace/radrly/accessradar/index.html` (różnią się tylko meta, og i CSS).

**Standard:** snapshoty ręczne i tygodniowe (co dwa tygodnie na darmowych instancjach do 10 użytkowników), historia 90 dni, Explore ze ścieżką "why", porównanie snapshotów, przeglądy z obowiązkowym uzasadnieniem (wcześniej podpisane przeglądy zostają czytelne), wyjątki z datą ważności do 366 dni, coverage statement, eksport CSV i PDF, jedenaście reguł ryzyka, tylko odczyt, weekly digest, Runs on Atlassian.

**Advanced dodaje:** harmonogramy dzienne i własne, historia od 30 do 3650 dni, cykliczne kampanie z przypomnieniami w aplikacji, delegowane przeglądy (Space settings → Apps), alerty w czasie rzeczywistym z regułami, weryfikacja naprawy, podpisane przeglądy SHA-256 (signature v2), łańcuch hashy z Verify, evidence pack PDF z mapowaniem SOC 2 / ISO, agent Rovo (pięć akcji).

Oznaczone jako "Planned": alerty o zmianach lub przypomnienia jako Jira work items.

### Kod [REPO]

- `origin/main` `src/domain/edition.ts` (commit a88a103, 2026-10-26 07:04 CET): flagi Advanced to `customSchedules`, `unlimitedHistory`, `remediationVerification`, `delegatedReviews`, `reviewCampaigns`, `changeAlerts`, `evidencePack`, `rovo` oraz nowa `signatureChain` ("Family rule (2026-10-26): signing, hash chain and Verify are always Advanced"). Standard ma retencję 90 dni. Commit 51ceee9 (2026-10-30 12:34 CET): nieaktywna licencja = Standard.
- Weekly digest nie ma flagi, czyli działa w każdej edycji (zgodnie z listingiem).
- Lokalny `main` (98be5d0, 2026-10-15) i `origin/release/production` nie mają flagi `signatureChain`. Najnowsza publiczna wersja w Marketplace to 2.43.0 z 2026-10-30. Nie sprawdzałem, z którego commita zbudowano 2.43.0.

## 4. Co jest LIVE, a co zatwierdzone lub oczekujące

| Element | Stan | Źródło |
|---|---|---|
| Edycje Standard i Advanced | **LIVE**, zatwierdzone przez Atlassian | listing `approvalTimestamp` 2026-10-27 11:52 CET [LIVE ✔ 2026-10-30] |
| Ceny Standard (0 / 0.75 / 0.55 / 0.35 / 0.20 / 0.15 / 0.12) | **LIVE** | listing + API v2 live [LIVE ✔ 2026-10-30] |
| Ceny Advanced ($4 / 1.49 / 0.99 / 0.99 / 0.49) | **LIVE** | listing [LIVE ✔ 2026-10-30]; API v2 nie zwraca Advanced |
| Ceny oczekujące (pending / draft) | **brak różnic**: `pending` = `live` | API v2 pending, uwierzytelnione [LIVE ✔ 2026-10-30] |
| Mapowanie funkcji z 2026-10-27 | **LIVE** | listing [LIVE ✔ 2026-10-30] |
| Roczne 10 x | **LIVE** | listing + API v2 [LIVE ✔ 2026-10-30] |
| Trial 30 dni | deklarowane, **niepotwierdzone w API** | strona [STRONA ✔ 2026-10-30], LISTING.md [REPO] |
| Cennik na stronie | zgodny z LIVE | [STRONA ✔ 2026-10-30] |

## 5. Daty zatwierdzeń i ich źródła

| Data | Co | Źródło |
|---|---|---|
| 2026-10-10 | Pierwszy cennik (1:1 z MarginRadar): Standard $0.75/0.60/0.40/0.25, Advanced $10 płasko + $1.99/1.49/0.99/0.49 | [NOTATKA]; `docs/LISTING.md` i `docs/name-pricing-legal.md` [REPO local main] |
| 2026-10-10 (później) | Standard $0.55/0.50/0.40/0.25, Advanced $4 + $0.99/0.89/0.79/0.45 | [NOTATKA] |
| 2026-10-14 | Standard $0 do 10, potem $0.49/0.35/0.25/0.20 ("FINAL") | [NOTATKA]; `docs/LISTING.md` "Ceny (FINAL, decyzja 2026-10-14)" [REPO origin/main] |
| 2026-10-23 (a) | Standard jak 10-14, Advanced jak obecny Advanced MarginRadar | [NOTATKA] |
| 2026-10-23 (b) | **Zatwierdzone przez Marcina**: Standard 0 do 10, $0.75/0.55/0.35/0.20/0.15/0.12; Advanced $4 + $1.49/0.99/0.99/0.49 | [NOTATKA]; zgodne z LIVE [LIVE ✔ 2026-10-30] |
| 2026-10-26 | Decyzje o funkcjach: podpis, łańcuch i Verify w Advanced; weekly digest w Standard; real-time alerts w Advanced; wyjątki w Standard bez podpisu | `docs/LISTING.md` i `edition.ts` [REPO origin/main, commity 48bfa70, a8d2591, 97dc1a0, a88a103, 07:04-07:26 CET] |
| 2026-10-27 11:52 CET | Atlassian zatwierdził edycje (oba `approvalTimestamp` identyczne) | listing [LIVE ✔ 2026-10-30]; numery zgłoszeń ECOHELP-177099 / 177791 tylko w [NOTATKA], niesprawdzalne publicznie |
| 2026-10-28 15:42 CET | Ostatnia zmiana cen w panelu (`lastModified`) | API v2 live i pending [LIVE ✔ 2026-10-30] |

## 6. Kody promocyjne (tylko nazwy i rabaty)

Źródło: `/workspace/radrly/promos/ff-codes.csv`, `sheet-merged.csv`, `ff-codes-annual.csv` (pliki lokalne, nie sprawdzałem ich w panelu Marketplace).

| Promocja | Rabat | Zakres | Liczba kodów | Ważne do | Stan |
|---|---|---|---|---|---|
| Friends & Family AccessRadar | 50% | miesięcznie, przez 12 miesięcy | 15 | 2027-12-31 | wszystkie "available", żaden nie przypisany do odbiorcy |
| Friends & Family AccessRadar (Annual) | 50% | rocznie, 1 okres | 15 | 2027-12-31 | wszystkie "available", żaden nie przypisany do odbiorcy |

Razem: 2 promocje, 30 kodów, rabat 50% w obu. Kodów celowo nie podaję.


## Marketplace panel (read 2026-10-30 19:38-19:41 CET)

Odczyt wyłącznie GET, z uwierzytelnieniem z `/home/box/.config/radrly/atlassian.env` (wartości tokenów nie są nigdzie zapisane). Edycje i ceny Advanced pochodzą z listingu, bo API vendora ich nie zwraca.

### Wyniki endpointów

| Endpoint (GET) | Uwierzytelnienie | HTTP | Wynik |
|---|---|---|---|
| `marketplace.atlassian.com/rest/2/addons/{key}/pricing/cloud/live` | konto Forge (token Forge) | **401** | `Unauthorized; scope does not match` |
| `.../pricing/cloud/pending` | konto Forge (token Forge) | **401** | `Unauthorized; scope does not match` |
| `.../pricing/cloud/live` | konto Jira (token API) | **200** | tylko edycja domyślna (Standard), `status: live`, `lastModified` 2026-10-28 15:42 CET, `canChangePrices: true`, 85 pozycji |
| `.../pricing/cloud/pending` | konto Jira (token API) | **200** | identyczne z `live` (porównanie bajt po bajcie bez linków: równe) |
| `.../pricing/cloud/live?edition=advanced` | konto Jira | **200** | parametr ignorowany, zwraca Standard |
| `.../pricing/cloud/pending?editionType=advanced` | konto Jira | **400** | parametr odrzucony |
| `.../pricing/cloud/pending` | bez logowania | **401** | `Unauthorized` |
| `.../pricing/cloud/live/advanced` | bez logowania | **401** | |
| `.../addons/{key}/editions`, `.../pricing/editions`, `.../pricing` | bez logowania | **404** | brak takich zasobów |
| `api.atlassian.com/marketplace/rest/3/developer-space` | konto Jira | **403** | `poco: rejected authenticated request` |
| `.../rest/3/developer-space/vendor/883180413` | konto Jira | **200** | developer space Radrly, ACTIVE |
| `.../rest/3/developer-space/{id}/catalog-account` | konto Jira | **200** | catalog account odczytany |
| `.../rest/3/app-software/app-key/{key}` i `.../app-software/{id}` | konto Jira | **200** | dane aplikacji, bez cen |
| `.../rest/3/app-software/{id}/editions`, `.../rest/3/apps/3691498947` | konto Jira | **404** | |
| `api.atlassian.com/commerce/api/v2/products` | konto Jira i Forge | **401** | `Unauthorized` |
| `.../commerce/api/v3/offerings/{id edycji Standard i Advanced}` | konto Jira | **401** | `Unauthorized` (tu byłaby długość triala) |
| `.../commerce/api/v2/offerings/{id edycji}/pricing-plans` (także `status=ACTIVE` i `DRAFT`) | konto Jira | **200** | pusta lista `{"values":[]}`; to samo dla dowolnego zmyślonego id, więc wynik nic nie mówi |
| `.../commerce/api/v2/offerings/x/pricing-plans` | konto Forge | **401** | `Unauthorized; scope does not match` |
| `.../commerce/api/v2/products/{key lub appSoftwareId}/offerings` | konto Jira | **200** | pusta lista |

Dokumentacja Atlassian opisuje Commerce Pricing API jako chwilowo niedostępne, co pasuje do pustych odpowiedzi. Changelog Marketplace zapowiadał wyłączenie API v2 na 2026-06-30, ale dziś v2 nadal odpowiada.

### Co zwraca panel (API v2, Standard, live = pending)

Metadane: `parent: jira-software.ondemand`, `status: live`, `hasPublishedPrices: true`, `canChangePrices: true`, `expertDiscountOptOut: false`, `contactSalesForAdditionalPricing: false`, `lastModified: 2026-10-28T14:42:52.496Z` (= 15:42 CET). Pozycje tylko typu COMMERCIAL. Pole `renewalAmount` wynosi wszędzie 50% `amount`; nie wiem, czemu w panelu odpowiada to pole, więc go nie interpretuję.

Pozycja `items` o `unitCount` 10 i `monthsValid` 1: $0.00 (darmowe do 10). 84 pozycje roczne (`monthsValid` 12) są identyczne z tabelą roczną Standard w sekcji 2.

#### Panel API v2 `pricing/cloud/live` (= `pending`), stawki miesięczne `perUnitItems`

| unitCount (górna granica progu) | amount (USD / użytk. / mies.) | renewalAmount |
|---|---|---|
| 100 | 0.75 | 0.375 |
| 250 | 0.55 | 0.275 |
| 1000 | 0.35 | 0.175 |
| 2500 | 0.2 | 0.1 |
| 5000 | 0.15 | 0.075 |
| 7500 | 0.12 | 0.06 |
| 10000 | 0.12 | 0.06 |
| 15000 | 0.12 | 0.06 |
| 20000 | 0.12 | 0.06 |
| 25000 | 0.12 | 0.06 |
| 30000 | 0.12 | 0.06 |
| 35000 | 0.12 | 0.06 |
| 40000 | 0.12 | 0.06 |
| 45000 | 0.12 | 0.06 |
| 50000 | 0.12 | 0.06 |
| 60000 | 0.12 | 0.06 |
| 70000 | 0.12 | 0.06 |
| 80000 | 0.12 | 0.06 |
| 90000 | 0.12 | 0.06 |
| -1 | 0.12 | 0.06 |


### Advanced w panelu

API vendora nie zwraca cen Advanced (v2 zwraca tylko edycję domyślną, a Commerce API zwraca 401 lub puste listy). Ceny Advanced w tym raporcie pochodzą z publicznego listingu (dane strony, odczyt 2026-10-30): $4 płasko do 10, potem $1.49 / $0.99 / $0.99 / $0.49 od 1 001 w górę, rocznie 10 x. Stanu draft dla Advanced nie da się dziś odczytać przez API, więc nie podaję żadnych wartości dla Advanced pending.

### Diff panel vs zatwierdzone ceny Marcina (2026-10-23 b)

| Próg | Standard zatwierdzone | Standard panel/listing | Advanced zatwierdzone | Advanced listing | Różnica |
|---|---|---|---|---|---|
| 1-10 | $0 | $0 | $4 płasko | $4 płasko | brak |
| 11-100 | $0.75 | $0.75 | $1.49 | $1.49 | brak |
| 101-250 | $0.55 | $0.55 | $0.99 | $0.99 | brak |
| 251-1 000 | $0.35 | $0.35 | $0.99 | $0.99 | brak |
| 1 001-2 500 | $0.20 | $0.20 | $0.49 | $0.49 | brak |
| 2 501-5 000 | $0.15 | $0.15 | $0.49 | $0.49 | brak |
| 5 001+ | $0.12 | $0.12 | $0.49 | $0.49 | brak |
| Roczne | 10 x | 10 x | 10 x | 10 x | brak |

Wniosek: panel i listing są w 100% zgodne z decyzją 2026-10-23 (b). Pending = live, nic nie czeka na publikację.

## 7. Rozbieżności

1. **Notatki 2026-10-14 i 2026-10-23 (a) vs LIVE.** Notatka 10-14 ustala Standard $0.49/0.35/0.25/0.20, a 10-23 (a) mówi "Standard zostaje jak 10-14". LIVE i decyzja 10-23 (b) mają $0.75/0.55/0.35/0.20/0.15/0.12. Notatka (b) nazywa to "bez zmian", choć różni się od 10-14.
2. **Notatka 2026-10-23 (a) "Advanced jak obecny Advanced MarginRadar" vs LIVE.** Dzisiejszy listing MarginRadar (zatwierdzony 2026-10-27 10:17 CET): Advanced $10 płasko, potem $1.99 / $1.75 / $0.99 / $0.55. AccessRadar Advanced LIVE: $4, $1.49 / $0.99 / $0.99 / $0.49. Nie są takie same (zgodnie z (b), niezgodnie z (a)).
3. **`docs/LISTING.md` w repo jest nieaktualny.** Lokalny main: ceny z 10-10 (Standard $0.75/0.60/0.40/0.25, Advanced $10 + $1.99/1.49/0.99/0.49). origin/main: "Ceny (FINAL, decyzja 2026-10-14)" Standard $0.49/0.35/0.25/0.20, Advanced $4 + $0.99/0.89/0.79/0.45 (100 użytk.: $490 i $990 rocznie). Oba różnią się od LIVE.
4. **`docs/accessradar-pricing-import.csv`.** Lokalny main ma ceny zgodne z LIVE Standard. origin/main ma model $0.49 (np. 100 użytk. $49 miesięcznie), czyli niezgodny z LIVE. Kto zaimportuje plik z origin/main, nadpisze ceny LIVE.
5. **Etykieta progu w notatce (b).** Notatka pisze "1-100 $1.49", a w Marketplace ten próg to 11-100 (1-10 to stała opłata $4).
6. **Numery ECOHELP.** Notatka podaje ECOHELP-177099 / 177791 dla AccessRadar; README app-central podaje ECOHELP-178259 dla MarginRadar. Numerów AccessRadar nie da się sprawdzić publicznie. Data zatwierdzenia (2026-10-27) zgadza się z listingiem.
7. **Podpisy SHA-256.** Cennik z 10-10 (`name-pricing-legal.md`) dawał podpisywanie w Standard. Dziś to Advanced (listing, strona, origin/main `signatureChain`). Lokalny main i `origin/release/production` nie mają jeszcze bramki `signatureChain`.
8. **Nazwa alertów.** Kod używa flagi `changeAlerts`, Marketplace i strona piszą "Real-time alerts". To tylko nazwa, ale warto ją wyrównać.
9. **Historia w Advanced.** Listing: "Unlimited history". Strona: historia ustawiana od 30 do 3650 dni (czyli do 10 lat, nie bez limitu).
10. **Trial.** 30 dni podają strona i LISTING.md, ale Marketplace nie podaje tej liczby publicznie, a endpoint Commerce z długością triala zwraca 401.
11. **Górny próg $0.12.** Strona pisze "5,001-100,000", listing ma progi miesięczne do 150 000, a roczne do 100 000.
12. **API v2 a edycje.** API v2 (`pricing/cloud/live|pending`) pokazuje tylko Standard. Jeśli ktoś w przyszłości zmieni Advanced w panelu, nie zobaczy tego przez ten endpoint.

## Źródła

- Listing Marketplace (dane `__INITIAL_STATE__`, odczyt 2026-10-30): https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira
- API v2: `https://marketplace.atlassian.com/rest/2/addons/026c4f6a-266d-4c42-aec5-7394371ad05d/pricing/cloud/live` i `/pending` (odczyt 2026-10-30 19:38 CET)
- Strona: https://accessradar.radrly.com (odczyt 2026-10-30)
- Repo `/workspace/accessradar`: `docs/LISTING.md`, `docs/accessradar-pricing-import.csv`, `docs/name-pricing-legal.md`, `src/domain/edition.ts` (lokalny main 98be5d0 i origin/main 51ceee9, tylko odczyt przez git show)
- `/workspace/radrly/promos/` (pliki kodów, tylko nazwy i rabaty)
- `/workspace/radrly/app-central/README.md`
- Listing MarginRadar (porównanie Advanced, odczyt 2026-10-30)
- Notatki Marcina z 2026-10-10, 10-14, 10-23, 10-27

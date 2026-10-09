# AccessRadar: wyniki tygodnia 1 (spike'i + szkielet)

| | |
|---|---|
| Data | 9.10.2026, 18:00–18:30 (Europe/Warsaw) |
| Site testowy | marginradar.atlassian.net (cloudId `fc225aa3-…5fc908`) |
| Forge app | **AccessRadar**, `ari:cloud:ecosystem::app/026c4f6a-266d-4c42-aec5-7394371ad05d`, developer space `radrly` |
| Wersja dev | 2.1.0 (major 2), runtime `nodejs24.x`, Forge CLI 14.1.0 na Node 22.23 |
| Dane Jiry | **niczego nie zmieniano**. Tylko odczyty (GET + `POST permissions/check`, który jest odczytem) |

## TL;DR

**Rekomendacja: GO.** Architektura z specyfikacji jest wykonalna przy wyłącznie granularnych scope'ach `read:*`:

1. **Wszystkie potrzebne endpointy działają** (projekty, schematy, granty, role i aktorzy, grupy i członkowie, application roles, `group/bulk?accessType=`, `permissions/check`) zarówno jako **`asApp()`**, jak i jako **offline impersonation `asUser(accountId)`** z kolejki async. Dowód: logi Forge z 18:09–18:10, `docs/spike-results/forge-probes-2026-10-09.json`.
2. **Zabezpieczenie read-only działa:** kontrolne `search/jql` (odczyt zgłoszeń) zwraca `401 Unauthorized; scope does not match` dla `asApp`, a przy impersonacji kończy się błędem uwierzytelnienia. Aplikacja nie widzi zgłoszeń.
3. **Niespodzianka (ważna dla security i UX):** przy samych scope'ach `read:*` app user AccessRadar dostał po instalacji **Administer Jira** (grupy `atlassian-addons-admin` i `jira-admins-…`) oraz rolę `atlassian-addons-project-access` we wszystkich projektach. Opcja B (`asApp`) działa więc „z pudełka” na tym site. Szczegóły i konsekwencje w sekcji 3.
4. **Team-managed (next-gen) projekty mają odczytywalny schemat uprawnień** („KAN: Simplified Permission Scheme”, `scope.type = PROJECT`). Nie trzeba osobnej ścieżki zbierania danych, ale trzeba osobnej semantyki: role są per projekt (`ProjectRole.scope`), a schemat jest 1:1 z projektem.
5. **Limity:** nagłówki potwierdzają pulę `"global-app-quota";q=65000;w=3600` **także dla impersonacji** (R14: tak, impersonacja liczy się do puli aplikacji). Nagłówki **nie podają pozostałych punktów** (tylko `t` = sekundy do resetu), a `Beta-RateLimit*` nie wystąpiły. Budżet punktów musimy liczyć sami.

Rekomendowany model tożsamości: **`asApp()` jako domyślny kolektor + ekran „Setup check”**, z **impersonacją jako fallbackiem** (opcja A), gdy klient odbierze app userowi uprawnienia. Uzasadnienie w sekcji 4.

---

## 1. Spike REST z tokenem API (JIRA_API_TOKEN, read-only)

Wołania przez gateway `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/…` z Basic auth. Konto Marcina: Administer Jira i Browse users and groups, **bez** SYSTEM_ADMIN. Helper: `spikes/j.sh` (nie drukuje tokenu).

> Uwaga: token okazał się **szerszy niż minimalny zestaw** (czyta też zgłoszenia, audit log, dashboardy i workflowy). Nie nadaje się więc do weryfikacji minimalnych scope'ów. Tę weryfikację zrobiłem w aplikacji Forge (sekcja 2), co i tak jest właściwym testem.

| Obszar | Wynik | Wniosek dla implementacji |
|---|---|---|
| Projekty `project/search` | 5 projektów: 4× `style=classic`, 1× `style=next-gen` (`simplified=true`, KAN). Paginacja `startAt/maxResults`, `isLast`, `nextPage` OK | Pętla do `isLast` (zaimplementowane: `src/lib/paginate.ts` + test) |
| Schemat projektu `project/{key}/permissionscheme` | 200 dla classic **i team-managed**. 4 projekty classic współdzielą „Default software scheme” (10033). KAN ma własny „KAN: Simplified Permission Scheme” (10000) | Deduplikacja po `schemeId`, mapa projekt → schemat |
| Lista schematów `permissionscheme?expand=all` | 3 schematy, w tym **schemat team-managed** z `scope: {type: PROJECT, project: {id: 10000}}` | Oznaczać schematy z `scope` jako „team-managed / per projekt” |
| Typy holderów na site | `projectRole`, `applicationRole` (bez `parameter` = „każdy z dostępem do dowolnej aplikacji Jira”). Brak `group`/`user`/`anyone` na tym site | Pozostałe typy obsługujemy wg dokumentacji. Fixture'y w testach |
| Role projektu `project/{key}/role` | Classic: role globalne (10002–10006). KAN: **osobne role z `scope` projektu** (Administrator 10007, Member 10008, Viewer 10009, jira-guest-member 10010, atlassian-addons-project-access 10011) | Klucz roli = (`projectId`, `roleId`). Nazwy ról team-managed się powtarzają, ale id są różne |
| Aktorzy `project/{key}/role/{id}` | `actorUser.accountId` / `actorGroup`. Rola `atlassian-addons-project-access` zawiera 11–12 kont typu `app` | Konta `app` domyślnie chowamy (S1) |
| Wszystkie role `GET /role` | 200, zwraca też role team-managed z `scope` | Przydatne do mapowania nazw |
| Grupy `group/bulk` | 34 grupy, paginacja OK (`startAt=30` → 4, `isLast=true`). Parametr `applicationKey` **sam w sobie jest ignorowany** | — |
| `group/bulk?accessType=admin` | `jira-admins-…`, `org-admins` | S2 OK |
| `group/bulk?accessType=site-admin` | `org-admins` | S2 OK |
| `group/bulk?accessType=user` | **400**, wymaga `applicationKey` (`jira-software`, `jira-servicedesk`, `jira-product-discovery`, `jira-core`). Z `applicationKey=jira-software` → `jira-users-…`, `org-admins` | Dokumentacja tego nie podkreśla. Iterować po kluczach aplikacji |
| Członkowie `group/member` | OK, `maxResults` + `isLast` + `nextPage`. Paginacja przetestowana (12 członków, strony po 5 → 3 strony). `groupname=` działa, ale używamy `groupId` | `includeInactiveUsers=true`. Dużo kont `app` w grupach adminów |
| Application roles `applicationrole` | 3 aplikacje (`jira-software`, `jira-servicedesk`, `jira-customer-service`) z `groupDetails` (groupId) i `defaultGroupsDetails` | Rozwinięcie holdera `applicationRole` = suma grup ról aplikacji |
| `permissions/check` (inny accountId) | 200, zwraca globalne (np. `USER_PICKER`, `CREATE_PROJECT`, `ADMINISTER`) i projektowe per projekt. Osobny limit burst 200/s | S2 „per osoba” działa. Pełnej listy holderów globalnych dalej nie ma |
| `mypermissions` | 200 (ADMINISTER, USER_PICKER) | Autoryzacja w resolverze (`src/lib/auth.ts`) |
| `user/groups`, `users/search` | 200. `users/search` zwraca 46 kont, w tym 45 typu `app` | — |

Burst: nagłówki `ratelimit-policy: "jira-burst-based";q=100;w=1`. `project/{}/role/{id}` ma własny limit (r=499 przez Forge). `permissions/check` ma limit 200.

## 2. Szkielet aplikacji Forge

| Element | Stan |
|---|---|
| `forge register AccessRadar` (developer space `radrly`) | ✅ nowa aplikacja, MarginRadar nietknięty |
| Manifest | `jira:adminPage` Custom UI z `sections` (Overview, Explore ×3, Changes, Reviews, Snapshots, Settings) + osobny `useAsGetStarted`. Dwa `scheduledTrigger` (hour tick, daily privacy), `trigger` lifecycle (installed/upgraded), `consumer` kolejki `accessradar-collect`, `sql` (mysql), `licensing.enabled`, runtime `nodejs24.x` |
| Scope'y | 15 granularnych `read:*` z `allowImpersonation: true` + `report:personal-data`. Zero `write`/`manage`, zero `read:jira-work`, zero egressu |
| `forge lint` | ✅ bez błędów. Ograniczenia lintera: klucz funkcji ≤ 23 znaki, klucze modułów muszą być unikalne między typami modułów, `tsconfig` nie może mieć `noEmit` (ts-loader przy deployu) |
| `forge deploy -e development` | ✅ 2.0.0, potem 2.1.0. CLI: **„eligible for the Runs on Atlassian program”** |
| `forge install` (development) na marginradar | ✅ 18:06. Brak konfliktu z MarginRadar (osobny app user „AccessRadar”) |
| Forge SQL | ✅ migracje przez kolejkę po `avi:forge:installed:app`: log „[migrate] applied 8” (8 tabel) w 5 s od instalacji |
| Testy | Vitest: 9 testów (resolver uprawnień, paginacja, Retry-After, reguły DDL). ESLint 10 + typescript-eslint, `tsc` czysto |
| CI | `ci.yml` (lint/typecheck/test/build/audit/forge lint), `deploy-dev.yml` (push na main, `--approve MAJOR_VERSION_RULE --confirm-scopes`, `install --upgrade` tylko ręcznie), `deploy-prod.yml` (gałąź `release/production`, tylko deploy), `codeql.yml`, Dependabot (npm ×2 + actions) |
| Admin page w przeglądarce | ⚠️ **Nie zweryfikowano wizualnie** (ta sesja nie miała przeglądarki). Instalacja i backend działają. Weryfikacja: otworzyć `https://marginradar.atlassian.net/jira/settings/apps/026c4f6a-266d-4c42-aec5-7394371ad05d/b98d505b-afb5-4c8d-a8f9-5306b85e352d` i sprawdzić w `forge logs -e development`, czy pojawił się wpis `[ui] getStatus ok`. Na podstronie *Settings* jest przycisk „Run probes” (spike `asUser` interaktywny + `asApp`) |

**Minimalne scope'y.** Zestaw 15 scope'ów to dokładnie **suma zestawów granularnych** z OpenAPI (`x-atlassian-oauth2-scopes`, stan Beta) dla używanych endpointów (`myself`, `mypermissions`, `project/search`, `project/{}/permissionscheme`, `project/{}/role[/{id}]`, `permissionscheme[/{id}[/permission]]`, `permissions`, `role`, `group/bulk`, `group/member`, `applicationrole`, `permissions/check`, `users/search`, `user/bulk`, `user/groups`). Wszystkie wołania zwróciły 200. Najdroższy pod względem ekranu zgody jest `project/search` (5 scope'ów „projektowych”: issue-type, hierarchy, version, component, property). Nie testowałem w runtime, czy endpoint działa z podzbiorem scope'ów, bo każda zmiana scope'ów to nowy major i reinstalacja. Warto to zrobić raz, przed prod (np. czy `read:field:jira` jest naprawdę potrzebny).

Uwaga z `forge lint`: przy samym `read:project:jira` linter zgłasza „`GET /mypermissions` requires `read:jira-work`”, czyli zna tylko classic. Z pełnym zestawem granularnym nie zgłasza nic. **Lint nie jest źródłem prawdy o minimalnych scope'ach.**

## 3. Tożsamość wywołań: asApp vs offline impersonation (opcje A/B z 8.4)

### Dokumentacja
- `asUser(accountId)` wymaga mapy scope'ów z `allowImpersonation: true` ✅. **Linter i deploy akceptują `allowImpersonation` na scope'ach granularnych** (pytanie z R2: tak).
- Impersonacja nie działa dla zdeaktywowanych użytkowników, użytkowników bez dostępu do aplikacji ani scope'ów wymagających zgody. Limit tokenów to 1 000/min per app.
- Impersonacja wymaga ujawnienia w Privacy & Security tab i jest pytaniem w security review (wg skilla).

### Test w zdeployowanej aplikacji (logi 18:09–18:10)
Po instalacji trigger lifecycle wrzucił do kolejki dwa eventy spike (opóźnienie 120 s i 150 s, bo uprawnienia app usera nadawane są „eventually consistent”):

| Endpoint | `asApp()` (kolejka) | `asUser(installerAccountId)` offline (kolejka) |
|---|---|---|
| `myself` | 200 (`accountType: app`) | 200 (`accountType: atlassian`) |
| `mypermissions` | ADMINISTER ✅, USER_PICKER ✅, ADMINISTER_PROJECTS ✅, SYSTEM_ADMIN ✗ | jak obok (uprawnienia Marcina) |
| `project/search` | 200, 5 projektów (classic + next-gen) | 200, 5 |
| `project/{key}/permissionscheme`, `project/{key}/role`, `role/{id}` | 200 / 200 / 200 (12 aktorów) | 200 / 200 / 200 |
| `permissionscheme?expand=all`, `permissions`, `role` | 200 (3 / 49 / 10) | 200 |
| `group/bulk`, `accessType=admin`, `accessType=site-admin` | 200 (34 / 2 / 1) | 200 |
| `group/member` | **200 (13)**, katalog odczytany | 200 |
| `applicationrole` | 200 (3) | 200 |
| `permissions/check` | 200 | 200 |
| `users/search` | 200 (47) | 200 |
| `search/jql` (kontrola negatywna) | **401 „scope does not match”** ✅ | błąd „Authentication Required” ✅ |

Nagłówki dla obu trybów: `ratelimit-policy: "global-app-quota";q=65000;w=3600, "jira-burst-based";q=100;w=1`.

### Uprawnienia app usera (sprawdzone tokenem po instalacji)
App user „AccessRadar” (`accountType=app`) został automatycznie dodany do grup: `atlassian-addons-admin`, `jira-admins-…`, `jira-users-…`, `jira-servicemanagement-users-…`, `jira-customer-service-users-…`. `permissions/check`: globalnie `ADMINISTER`, `USER_PICKER`, `CREATE_PROJECT`, a projektowo BROWSE/ADMINISTER_PROJECTS we wszystkich 5 projektach (w tym team-managed, przez rolę `atlassian-addons-project-access`).

Porównanie: app user MarginRadar (inne scope'y) **nie** ma ADMINISTER (tylko USER_PICKER i CREATE_PROJECT). Najpewniej to granularne scope'y „konfiguracyjne” (`read:permission-scheme`, `read:application-role`, `read:project-role` …) skutkują dodaniem do grupy adminów. To hipoteza: nie znalazłem tego w dokumentacji ❓. AccessLens pisze o „katalogu odmawiającym odczytu członków grup”, ale na tym site tego problemu nie ma.

**Konsekwencje:**
- (+) Opcja B działa bez ręcznej konfiguracji u klienta.
- (−) App user z Administer Jira wygląda groźnie w audycie u klienta, czyli dokładnie u naszej persony. Trzeba to uczciwie opisać na stronie Security & data („Atlassian nadaje app userowi grupę admin, ale aplikacja ma tylko scope'y odczytu, więc nie może niczego zmienić”). Scope'y ograniczają API niezależnie od uprawnień Jiry: kontrola `search/jql` to potwierdza.
- (−) Admin klienta może usunąć app usera z grup. Wtedy `group/member` / `applicationrole` / schematy zwrócą 403 i snapshot będzie „partial”. Potrzebny jest „Setup check” plus fallback na impersonację.
- Każde `asApp()` w resolverach poprzedzamy autoryzacją wołającego (`mypermissions` asUser → ADMINISTER), co jest już zrobione w `assertJiraAdmin()`.

## 4. Rekomendacja architektury (go/no-go)

**GO**, z decyzjami:

1. **Kolektor = `asApp()` (opcja B) domyślnie.** Nie zależy od konkretnej osoby, działa z harmonogramu i nie wymaga przechowywania „collector identity”.
2. **Impersonacja (opcja A) jako fallback** dla klientów, którzy ograniczą app usera. Admin może wtedy wskazać siebie jako „collector”. Działa z granularnymi scope'ami. Koszt: `allowImpersonation` w manifeście = pytanie w review i ujawnienie w Privacy tab. **Decyzja do podjęcia przed 1. prod:** czy deklarować `allowImpersonation` od v1.0 (zmiana później = major + zgoda adminów), czy wyciąć. Moja rekomendacja: **zostawić** (tańsze niż późniejszy major), ale używać tylko po świadomym włączeniu przez admina.
3. **Setup check** (ekran + test przy każdym snapshocie): `mypermissions` asApp (ADMINISTER, USER_PICKER), próbka `group/member`, `applicationrole`. Wynik trafia do `completeness_json`.
4. **Team-managed:** ta sama ścieżka (schemat per projekt jest czytelny). W UI oznaczamy „team-managed” i role per projekt. Nie odtwarzamy „access level” (open/limited/private) jako osobnego pola, bo wynika on z grantu BROWSE dla `applicationRole` w schemacie. To do potwierdzenia na projekcie private ❓ (na site jest tylko jeden projekt team-managed, a nowego nie tworzyłem).
5. **Limity:** impersonacja i asApp liczą się do tej samej puli 65k/h. Nagłówki nie pokazują zużycia, więc budżet liczymy z reguł (1 + 2 × liczba obiektów identity) i logujemy szacunek per snapshot. Obsługa 429: `Retry-After` → `InvocationError` (helper `retryAfterSeconds` gotowy).
6. **Uprawnienia globalne:** jak w spec (S2): `accessType=admin|site-admin` + `user` iterowane po `applicationKey` + `permissions/check` per osoba. Etykieta „częściowe”.

## 5. Ryzyka zaktualizowane

| # | Zmiana statusu |
|---|---|
| R1 | Pula 65k/h potwierdzona nagłówkiem dla asApp i impersonacji. Realnego kosztu nie da się zmierzyć z nagłówków (brak `r=` dla global-app-quota) |
| R2 | ✅ Rozwiązane: oba tryby działają z granularnymi `read:*`. Nowe ryzyko: app user dostaje Administer Jira (komunikacja security) |
| R4 | 🟡 Częściowo: schemat team-managed jest czytelny, role per projekt. Private/limited do sprawdzenia |
| R14 | ✅ Tak, impersonacja liczy się do `global-app-quota` |
| Nowe R15 | Klient usuwa app usera z grup adminów → dane niepełne. Mitigacja: Setup check + fallback impersonacji |
| Nowe R16 | Spike'owy kod (`src/spike`, przycisk „Run probes”) jest za flagą `ACCESSRADAR_SPIKE=1` (zmienna tylko w development). **Usunąć przed prod** |

## 6. Repo i stan push

- Lokalnie: `/workspace/accessradar`, gałąź `main`, commity gotowe.
- Push: **brak poświadczeń GitHub na boxie** (brak `gh auth`, `~/.git-credentials`, tokenu w env, klucza SSH dla github.com). Konektor GitHub nie ma narzędzia do pushowania plików. Push trzeba wykonać z maszyny z dostępem albo dodać token lub deploy key.
- Przed pierwszym CI deployem: dodać sekrety `FORGE_EMAIL` i `FORGE_API_TOKEN` w repo (Settings → Secrets → Actions). `app.id` w manifeście jest już prawdziwy.
- Repo jest **publiczne**. Nie ma w nim tokenów ani accountId (wyniki spike'ów zawierają tylko statusy i liczniki).

## 7. Następne kroki (tydzień 2)
1. Wizualna weryfikacja admin page (link wyżej) + „Run probes” (interaktywne `asUser`).
2. Pipeline PLAN → FINALIZE na `asApp`, idempotencja `job_step`, 429/Retry-After, Setup check.
3. Seed script (syntetyczne grupy/role/projekty, w tym team-managed private) do pomiaru kosztu punktowego.
4. Decyzja: `allowImpersonation` w v1.0 (rekomendacja: tak) i ewentualne odchudzenie scope'ów (test podzbiorów raz, przed prod).

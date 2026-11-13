# AccessRadar GEO status

Brief: `/workspace/radrly/ai-visibility/briefs/accessradar.md`
Plan: `/workspace/radrly/ai-visibility/geo-plan-2026.md`
Zdanie kanoniczne (EN): AccessRadar by Radrly is a read-only Jira Cloud app (Atlassian Forge) for access reviews and permission audits: it shows who has access to which project and why, and produces signed review evidence for SOC 2 and ISO 27001.

## Kickoff (2026-10-29)

Zrobione:
- przeczytany brief i plan GEO
- utworzona rutyna piątkowa statusu (AccessRadar GEO status piątek, ~11:00 Europe/Warsaw)
- wstępny audyt powierzchni (poniżej)

W toku:
- [zrobione 29.10] ujednolicenie opisu (subtitle, meta ≤155, og/twitter, llms.txt) do zdania kanonicznego
- [zrobione 29.10] JSON-LD `@graph` (SoftwareApplication z publisher `@id` Radrly, sameAs, FAQPage, BreadcrumbList na podstronach)
- [zrobione 29.10] sekcja FAQ na stronie głównej (wymagana, żeby FAQPage odpowiadał widocznej treści)

Blokery: brak

Szkice do zatwierdzenia: brak

### Audyt spójności (29.10, lokalny checkout Mac + live)

| Powierzchnia | Stan vs zdanie kanoniczne |
|---|---|
| Subtitle pod H1 | „Access Reviews for Jira Cloud” (bez „by Radrly”, bez permission audits / SOC 2) |
| meta description (live ~156 znaków) | stary tekst „See who has access…”, nie kanoniczne; lekko ponad 155 |
| og/twitter description | stary tekst, bez „by Radrly” |
| JSON-LD | pojedynczy SoftwareApplication; description stare; publisher inline bez `@id` Organization; brak alternateName listy z briefu; brak sameAs (listing, LinkedIn, YouTube); brak FAQPage i BreadcrumbList; ma `offers` z cenami (brief: bez offers z cenami w nowych blokach) |
| llms.txt (live) | pierwsze zdanie zbliżone, ale nie dosłownie kanoniczne; lokalny checkout Mac nie ma llms.txt |
| docs meta | opis dokumentacji, OK na razie |
| FAQ na homepage | brak sekcji FAQ |
| Listing Marketplace / LinkedIn / YouTube | poza zakresem zmian żywych bez Marcina; teksty do 13.11 dla Marketingu |

### Korekta Marketing (29.10)
Publisher `@id` w JSON-LD: `https://radrly.com/#org` (nie `#organization`).

## Wdrożenie tydzień 1 (2026-10-29, ok. 07:31 Europe/Warsaw)

Wdrożone na produkcję (accessradar.radrly.com), commit radrly `940f187` (pushed, origin/main) [skip ci].
- Backup VPS przed rsync: `/srv/radrly/accessradar.bak-20261029-0730-geo` (84 pliki, 7.0M) na 84.247.134.34.
- Deploy: z Maca, `rsync -az` folderu `accessradar/` do `vps:/srv/radrly/accessradar/` bez `--delete` (najpierw dry-run). Treść zmieniona tylko w: index.html, llms.txt, llms-full.txt, sitemap.xml (pozostałe pliki tylko mtime).
- Przed zmianą: lokalny checkout Maca był 5 commitów za origin; po `git pull --ff-only` był identyczny z live (llms.txt, llms-full.txt, BreadcrumbList już były).
- Kopia wdrożonych plików HTML/TXT/XML zsynchronizowana też do `/workspace/radrly/accessradar/` na boxie (assets bez zmian).

Co jest live:
- https://accessradar.radrly.com/ : subtitle pod H1 „AccessRadar by Radrly: read-only Jira access reviews and permission audit”.
- meta description (155 znaków): „AccessRadar by Radrly: read-only Jira Cloud app for access reviews and permission audits: who has access and why, with signed SOC 2 and ISO 27001 evidence.”
- og:description = pełne zdanie kanoniczne; twitter:description = meta description.
- JSON-LD: jeden blok `@graph`: SoftwareApplication `#app` (alternateName [Access Radar, AccessRadar for Jira], description = zdanie kanoniczne, publisher i author `{"@id":"https://radrly.com/#org"}`, sameAs: listing, LinkedIn, YouTube H7xGSTA0A4A, image og.png, softwareHelp docs, installUrl) + FAQPage `#faq` (8 pytań, `about` → `#app`). Bez `offers`/cen.
- https://accessradar.radrly.com/#faq : widoczna sekcja „Frequently asked questions” (8 pytań z briefu, `<details>` jak FAQ w docs), treść 1:1 z FAQPage.
- https://accessradar.radrly.com/llms.txt : blockquote = zdanie kanoniczne dosłownie, dodany link do /#faq.
- https://accessradar.radrly.com/llms-full.txt : to samo + subtitle + sekcja FAQ w części strony głównej.
- BreadcrumbList (AccessRadar → strona) na docs/, security/, support/, privacy/, terms/, dpa/, release-notes/ (był już live z 27/28.10, bez zmian).
- sitemap.xml: lastmod strony głównej 2026-10-29, XML poprawny; brak nowego URL (FAQ to kotwica).

Walidacja:
- curl: wszystkie strony 200; zero em dashes w index.html.
- validator.schema.org (URL homepage): 0 błędów, 0 ostrzeżeń; wykryte SoftwareApplication + FAQPage (8 Question/Answer). docs/ i security/: BreadcrumbList bez błędów.
- radrly.com ma Organization `@id` https://radrly.com/#org, więc referencja publisher się rozwiązuje.
- Google Rich Results Test: do zrobienia ręcznie (pending). Uwaga: Google od 2023 pokazuje FAQ rich results tylko dla stron rządowych/medycznych, a snippet SoftwareApplication wymaga offers lub aggregateRating (świadomie usunięte), więc brak rich results w SERP jest oczekiwany; bloki służą GEO/LLM i grafowi encji.

Pozostało do 6.11:
- Rich Results Test / Search Console: zgłosić homepage do ponownego zaindeksowania (Marcin, konto GSC).
- Sprawdzić po 2-3 dniach, czy cache/LLM crawlers widzą nowy llms.txt (logi nginx: GPTBot, ClaudeBot, PerplexityBot).
Do 13.11 (poza zakresem zmian bez Marcina):
- Teksty dla Marketingu: opis listingu Marketplace, LinkedIn company page, opis YouTube H7xGSTA0A4A ujednolicone do zdania kanonicznego (szkice, bez publikacji).
- Ewentualnie osobna strona /faq/ (wtedy nowy URL w sitemap) i FAQ ↔ docs#faq spójność.

## Tydzień 0 (2026-10-26)
Zrobione:
https://accessradar.radrly.com/
https://accessradar.radrly.com/#faq
https://accessradar.radrly.com/llms.txt
https://accessradar.radrly.com/llms-full.txt
https://accessradar.radrly.com/sitemap.xml
(29.10: zdanie kanoniczne w subtitle, meta, og/twitter i llms.txt; JSON-LD `@graph` SoftwareApplication + FAQPage, walidator schema.org 0 błędów; widoczna sekcja FAQ 8 pytań; sprawdzone 30.10: strony 200, FAQ live)
W toku:
- Do 6.11: sprawdzenie w logach nginx, czy GPTBot, ClaudeBot i PerplexityBot pobrały nowy llms.txt; Rich Results Test homepage.
- Do 13.11: strona https://accessradar.radrly.com/what-is-accessradar/ (dziś 404, do zrobienia) plus wpis w sitemap.xml i llms.txt; szkice tekstów dla Marketingu (pierwsze zdanie listingu Marketplace, strona LinkedIn, opis YouTube H7xGSTA0A4A) w drafts/accessradar/, bez publikacji.
- Do 20.11: porównania fala 1 (vs Atlassian Guard, Atlassian Guard alternatives), po weryfikacji cech na publicznych stronach.
Blokery: brak (prośba do Marcina, nie blokuje: zgłosić https://accessradar.radrly.com/ do ponownego zaindeksowania w Google Search Console, gdy będzie przy koncie GSC)
Szkice do zatwierdzenia: brak

## Tydzień 1 (2026-11-02)
Zrobione:
https://accessradar.radrly.com/what-is-accessradar/
https://accessradar.radrly.com/
https://accessradar.radrly.com/docs/
https://accessradar.radrly.com/llms.txt
https://accessradar.radrly.com/llms-full.txt
https://accessradar.radrly.com/sitemap.xml
(9.11, ok. 08:18 Europe/Warsaw: nowa strona What is AccessRadar? (H1, pierwszy akapit = zdanie kanoniczne, co robi, dla kogo, jak działa w 5 krokach, Standard i Advanced na poziomie funkcji bez cen, link do listingu, docs, security, FAQ, kto tworzy z linkiem do radrly.com/about/, FAQ 3 pytania); JSON-LD @graph BreadcrumbList + AboutPage (about #app, publisher radrly.com/#org) + FAQPage, bez offers; link w stopce strony głównej i docs; wpis w llms.txt, llms-full.txt i sitemap.xml (lastmod 2026-11-09). Commit radrly fc572ad [skip ci] na origin/main, backup VPS /srv/radrly/accessradar.bak-20261109-0818-geo, rsync bez --delete po dry-run. Walidacja: wszystkie 18 adresów 200, zero półpauz i pauz w zmienionych plikach, sitemap XML poprawny (12 URL), validator.schema.org dla /what-is-accessradar/: 0 błędów, 0 ostrzeżeń. IndexNow: 3 URL (what-is, strona główna, docs), HTTP 200.)
(Logi nginx, 29.10 do 9.11: pobrania /llms.txt i /llms-full.txt, wszystkie z kodem 200: GPTBot 12 (ostatnio 8.11), ClaudeBot 9 (ostatnio 1.11), OAI-SearchBot 4, ChatGPT-User 1, Claude-User 1, PerplexityBot 0. Log jest wspólny dla wszystkich stron na VPS i nie zapisuje nazwy hosta, więc nie da się wydzielić samego accessradar.radrly.com; do tego trzeba dodać $host do log_format w nginx, zmiana dla Marcina, nie wdrażałem.)
W toku:
- Do 13.11: Rich Results Test dla strony głównej i /what-is-accessradar/ w przeglądarce (validator.schema.org już 0 błędów).
- Do 13.11: szkice dla Marketingu w drafts/accessradar/ (pierwsze zdanie listingu Marketplace, strona LinkedIn, opis YouTube H7xGSTA0A4A), bez publikacji.
- Do 20.11: porównania fala 1 (vs Atlassian Guard, Atlassian Guard alternatives), po sprawdzeniu cech na publicznych stronach. Uwaga: na live jest już /alternatives/ z 3.11, sprawdzić, czy nowa strona go uzupełnia, a nie dubluje.
- Uwaga techniczna: live accessradar.radrly.com wyprzedzał repo radrly (guides/, alternatives/, nagłówek z r-glyph, ceny Advanced, CSS). Zmienione pliki wziąłem z live i dopiero na nich zrobiłem poprawki, więc nic nie zostało cofnięte. Pozostałe pliki (guides/, alternatives/, assets, inne podstrony) nadal są tylko na VPS, nie w main.
Blokery: brak (prośba do Marcina, nie blokuje: zgłosić https://accessradar.radrly.com/ i https://accessradar.radrly.com/what-is-accessradar/ do ponownego zaindeksowania w Google Search Console)
Szkice do zatwierdzenia: brak

## Tydzień 2 (2026-11-09)
Zrobione:
https://accessradar.radrly.com/
https://accessradar.radrly.com/what-is-accessradar/
https://accessradar.radrly.com/#faq
https://accessradar.radrly.com/docs/
https://accessradar.radrly.com/release-notes/
https://accessradar.radrly.com/security/
https://accessradar.radrly.com/privacy/
https://accessradar.radrly.com/llms.txt
https://accessradar.radrly.com/llms-full.txt
https://accessradar.radrly.com/sitemap.xml
https://accessradar.radrly.com/guides/
https://accessradar.radrly.com/guides/offboarding-check-deactivated-users-jira-groups/
https://accessradar.radrly.com/alternatives/
(9.11, ok. 08:18 Europe/Warsaw: strona What is AccessRadar i FAQ na stronie głównej, już zapisane w Tygodniu 1; termin briefu 13.11 dotrzymany. IndexNow 9.11: 3 URL o 08:18 HTTP 200, potem 12 URL o 23:42 HTTP 200.)
(11.11: wspólny hero na stronie głównej: eyebrow, H1 = AccessRadar, podtytuł "See who has access to what in Jira, and why.", akapit .lead = pełne zdanie kanoniczne. JSON-LD SoftwareApplication description nadal = zdanie kanoniczne, FAQPage 8 pytań, sekcja #faq na miejscu. Meta, og i twitter description skrócone 9.11 do 158 znaków, z "by Radrly" oraz SOC 2 i ISO 27001; brief zakłada maksimum 155.)
(12.11: dokumentacja, release notes, privacy i security, w tym 3.0.0 i 3.1.0 oraz 12 języków UI z nazwami; lastmod w sitemap 2026-11-12 dla home, What is, docs, release-notes, security i privacy. Commity m.in. 71a8ccd, 3c89f0c, 113f672, f98f0da na origin/main. /alternatives/ i /guides/ były live wcześniej; w tym tygodniu tylko drobne poprawki SEO i consent. Live llms.txt jest do przodu względem origin/main: opisuje już 3.2.0, 3.3.0, 3.4.0 i 4.0.0, lokalny plik w main ma 3.0.0.)
W toku:
- Do 20.11: porównania fala 1 (/compare/atlassian-guard/ i alternatives dla Atlassian Guard). Oba adresy dają 404. Istnieje https://accessradar.radrly.com/alternatives/ (Last checked: 2026-11-03) z porównaniem do AuditAdmin, Project Access Review i Access Reviewer360, nie do Guard; nowa strona ma uzupełniać, nie dublować.
- Do 13.11 (termin dziś): Rich Results Test strony głównej i /what-is-accessradar/ w przeglądarce (validator.schema.org wcześniej 0 błędów). Nie uruchomiony w tym przebiegu.
- Do 13.11 (termin dziś): szkice dla Marketingu w drafts/accessradar/ (pierwsze zdanie listingu Marketplace, strona produktu LinkedIn). Katalog drafts/accessradar/ nie istnieje. W dzienniku wspólnym (Publikacje, 10.11 18:27 Europe/Warsaw) jest zapis, że opis teasera YouTube H7xGSTA0A4A został zapisany na @radrlycom; treści na YouTube nie weryfikowałem w tym przebiegu.
- Do 27.11: 3 artykuły how-to z briefu (kwartalny access review SOC 2 / ISO 27001, nieaktywni użytkownicy, eksport dowodów). Live jest już przewodnik offboarding dezaktywowanych użytkowników w grupach Jira.
- Do 4.12: porównania fala 2 (vs Power Admin, vs Optimizer for Jira).
- IndexNow po wdrożeniach z 11.11 i 12.11: nie potwierdzony w logach (ostatni wpis AccessRadar 9.11 23:42).
Blokery: brak (prośba do Marcina, nie blokuje: zgłosić https://accessradar.radrly.com/ i https://accessradar.radrly.com/what-is-accessradar/ do ponownego zaindeksowania w Google Search Console)
Szkice do zatwierdzenia: brak

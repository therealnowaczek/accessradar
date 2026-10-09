# AccessRadar: publikacja na Atlassian Marketplace (wg doświadczeń MarginRadar, 9.10.2026)

## 0. Przed startem
- [ ] Ten sam Developer Space „Radrly” (804cc92c-…) i partner 883180413. NIE zakładać nowego partnera (pułapka z MarginRadar: publikacja space'a tworzy nowego partnera).
- [ ] Partner Verification jest już zrobiona raz na partnera (ECOHELP), więc jej nie powtarzamy.
- [ ] Logowanie do marketplace.atlassian.com/manage wymaga 8-cyfrowego kodu z maila marcin@radrly.com; zawsze brać najnowszy.

## 1. Apka
- [ ] manifest: `app.licensing.enabled: true`, runtime nodejs24.x, zero egressu (Runs on Atlassian automatycznie)
- [ ] Developer console: Distribution = Sharing
- [ ] Prod: gałąź release/production (fast-forward z main), `forge deploy --environment production` (CI)
- [ ] Usunąć kod spike (ACCESSRADAR_SPIKE) przed prod
- [ ] Zrzuty ekranu do listingu robić z prod (na dev widać dopisek „Dev”)

## 2. Strona accessradar.radrly.com
- [ ] /privacy /terms /dpa (bez dopisku „draft”) /security (sekcje Incident response + Secure development) /support /docs
- [ ] Jeden kontakt wszędzie: marcin@radrly.com
- [ ] Treść privacy zgodna z kodem (accountId, ewentualny cache display names)

## 3. Listing (Partner console > Create app > Forge app)
- [ ] Compatible app = Jira Cloud; License = Commercial; Paid via Atlassian
- [ ] Nazwa ≤60, tagline ≤130 bez kropki na końcu, summary ≤250, more details ≤1000, max 2 kategorie, 4 keywords
- [ ] Layout Highlight: 3 highlighty (tytuł ≤50, opis ≤220, każdy z obrazem)
- [ ] Grafiki: logo 144×144, banner 1120×548, highlighty/galeria min 920×450 (zalecane 1840×900)
- [ ] Linki: docs, support, privacy, EULA/terms, DPA, security
- [ ] Pułapka: zapis highlightów („File does not exist”/„Must be a valid UUID”); jeśli wystąpi, zapisać ręcznie z innej przeglądarki

## 4. Cennik
- [ ] Standard: darmowy do 10 userów, potem tiery per user (MarginRadar: $0.75/$0.60/$0.40/$0.25; dla AccessRadar do decyzji)
- [ ] Multi-instance = single-instance; roczna cena = 10× miesięczna (automatycznie)
- [ ] Edycja Advanced dopiero po zatwierdzeniu

## 5. Privacy & Security tab
- [ ] Runs on Atlassian, zero egress, data residency jak Jira (Forge SQL/KVS), lista danych, personal data = Yes, DPA
- [ ] Zapisuje się jako draft (bez submitu); w trakcie review zablokowana

## 6. Security Questionnaire (przed submitem zweryfikować każde „Yes” w kodzie)
- [ ] permissions/check przed każdym asApp, rola/projekt rozwiązywane po stronie serwera, walidacja payloadów
- [ ] Dependabot + npm audit + CodeQL
- [ ] report:personal-data + dzienny raport i erasure
- [ ] Uzasadnić uprawnienia admina app usera (atlassian-addons-admin / Administer Jira) i allowImpersonation

## 7. Submit
- [ ] Wersja > Make public > Submit > akceptacja Publisher Agreement (zgoda Marcina)
- [ ] Ticket App Approval w ecosystem.atlassian.net (portal 34): Partner Verification + Privacy tab + Security Questionnaire (przycisk Marketplace Security, zakładki Partner, Partner-Extended, Forge, Contacts, Vulnerabilities > Save > Submit for Review)
- [ ] Odpowiadać TYLKO w portalu (maile nie docierają). Functional review ~10 dni roboczych

## 8. W trakcie review
- [ ] Prod deploy z poprawkami dozwolony; NIE zmieniać scope'ów ani egressu; listing i privacy zablokowane

## 9. Po zatwierdzeniu
- [ ] Finalne zrzuty z prod, edycja Advanced, kolekcja Rovo, opcjonalnie bug bounty / Cloud Fortified

## Do skopiowania 1:1 z MarginRadar
Workflowy GH Actions (ci z audit, codeql, dependabot, deploy-development, deploy-production), moduł privacy, struktura strony radrly.com, schemat cennika, kontakty partnera. Listing MarginRadar: /workspace/atlassian-marketplace-research/LISTING.md

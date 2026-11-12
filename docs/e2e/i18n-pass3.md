# E2E: i18n coverage pass 3 (dev, ARTEST, 2026-11-12)

About 800 more UI strings keyed (templates, fragments, label maps, toasts, errors); 585 new keys translated into the 11 non-English locales (machine-drafted by Claude, not native-reviewed). No manifest or scope change.

- English: 18/18 PASS light and 18/18 PASS dark (Sharing and security as Advanced/Standard, all 12 pages, Why panel, Verify, snapshot).
- Per locale, light: de-DE, ja-JP, fr-FR, es-ES, pt-BR, pl-PL, ko-KR, it-IT, nl-NL, zh-CN, zh-TW all 13 nav pages load, no raw `{placeholder}`, `plural,`, `undefined`, `NaN` or replacement characters in the text. Dark: ja-JP and pl-PL PASS.
- Account language and theme restored (English US, Light). `forge logs -e development` has no errors.
- Stays English by design: exports (CSV/PDF/JSON/Markdown), Rovo agent text, Jira permission names, server messages and user data. Not checked in a browser: every individual drawer and dialog in every locale.

# JSON export (schema version 1)

Available in the existing Export menus: Spaces (access matrix and one space), Snapshots (access matrix), Changes,
Reviews (review JSON, and "Evidence pack JSON" for a signed review, Advanced only). The file is built in the browser
like the CSV, PDF and Markdown files. Nothing is sent anywhere.

Schema: `docs/schemas/accessradar-export-v1.schema.json` (JSON Schema draft-07). Tests validate every kind against it
and compare against the golden files in `static/app/src/export/__golden__/`.

## Envelope (all kinds)

| Field | Meaning |
|---|---|
| `schema` | always `accessradar-export` |
| `schemaVersion` | integer, `1`. New optional fields keep 1. Removing or redefining a field raises it. |
| `kind` | `access-matrix`, `changes`, `review` or `evidence-pack` |
| `generatedBy` | `{ app, version, readOnly: true }` |
| `site` | site URL or `null` |
| `exportedAt` | ISO 8601 UTC |
| `timeZone` | IANA zone of the person who exported (informational; all timestamps are UTC) |

## Kinds

- `access-matrix`: `snapshot`, `limitations`, `coverage`, `columns`, `rows` (the same columns as the CSV; `active` is a
  boolean or `null`), `risks`. The whole-site export carries every permission; a space export is filtered to the space.
- `changes`: `snapshotA`, `snapshotB`, `keyPermissions`, `rows` (granted, revoked and configuration changes, same
  columns as the CSV).
- `review`: `review` (status, scope, signature or `null` when unsigned), `baseSnapshot`, `compareSnapshot`,
  `limitations`, `coverage`, `items` (permissions, access path, decision, note, expiry, who and when).
- `evidence-pack` (Advanced, signed reviews only): `header` (hashes, signature version, chain), `sections`
  (methodology, limitations, coverage, summary, control mapping, exceptions, remediation, audit excerpt), `items`.
  A Standard site is refused by the server (`getEvidencePack`).

## Notes

- Coverage and limitations are always included, as in every other format.
- Decision `revoke` means "to do in Jira"; AccessRadar never changes Jira.
- Exports are written to the audit log like the other formats (`matrix-json`, `changes-json`, `review-json`,
  `evidence-pack-json`).

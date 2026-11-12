# Control mapping in the AccessRadar evidence pack

Applies to evidence pack mapping version 2 (`CONTROLS_VERSION` in `src/domain/controls.ts`). Advanced edition, PDF evidence pack of a signed review ("Control mapping" section).

## What this is

A control-level table that shows which AccessRadar evidence relates to which control. It **supports evidence collection** for access control reviews. It is not a certification, not a statement of compliance, and not legal advice. Whether a control is met, and whether it operates effectively, is decided by the organisation and its auditor.

AccessRadar is read-only: it reads Jira configuration (permission schemes, roles, groups, application roles) and records review decisions. It does not change access and it sends no data outside Atlassian (Runs on Atlassian, zero egress).

## Mapping

| Framework | Control | AccessRadar evidence |
|---|---|---|
| SOC 2 | CC6.1 Logical access security, restricted access | Effective access inventory with why-path resolution; risk rules for anonymous grants, broad application roles and app-account admins. |
| SOC 2 | CC6.2 Registration and authorization; removal when no longer needed | Revoke decisions with a mandatory justification; remediation verification against later snapshots; inactive-user risk rule ("inactive" means a deactivated Atlassian account, not last-login age). |
| SOC 2 | CC6.3 Role-based access, periodic review, least privilege | Signed periodic access reviews; Recheck of decisions whose access changed before sign-off; exceptions with expiry and re-review; wide-admin risk rule. |
| ISO/IEC 27001:2022 | A.5.15 Access control | Site access picture, key-permission reviews, coverage and limitations disclosure. |
| ISO/IEC 27001:2022 | A.5.18 Access rights (provision, review, removal) | Keep / revoke / exception decisions with sign-off, evidence hash, Recheck of stale decisions and remediation status. |
| ISO/IEC 27001:2022 | A.8.2 Privileged access rights | Admin, wide-admin and app-accounts-admin risk indicators from snapshot data. |
| NIS2 | Art. 21(2)(i) Human resources security, access control policies and asset management | Effective access inventory with why-paths, periodic keep / revoke / exception reviews, privileged-access risk indicators. The policy itself stays with the organisation. |
| NIS2 | Art. 21(2)(f) Policies and procedures to assess the effectiveness of cybersecurity risk-management measures | Signed, hash-chained access reviews, remediation verification, and a coverage and limitations statement for each review. |

## How to read the evidence

- Every signed review carries a SHA-256 evidence hash, linked into a chain you can verify in the app ("Verify signature and chain").
- The pack states what AccessRadar could not see (coverage and limitations), for example Jira global permission holders and work item security levels.
- Review decisions that became stale because access changed after the snapshot are shown as Recheck and must be decided again before sign-off.

## What is not claimed

- No claim of SOC 2, ISO 27001 or NIS2 compliance or certification.
- No evidence of controls outside Jira access (for example identity provider policy, offboarding in HR systems, MFA settings).
- Mapping text is versioned. When the wording changes, `CONTROLS_VERSION` is bumped and the version is printed in the pack.

## Changing the mapping

Edit `CONTROL_MAPPINGS` in `src/domain/controls.ts`, bump `CONTROLS_VERSION`, update this page and `test/controls.test.ts`. Keep the wording at "supports evidence" level.

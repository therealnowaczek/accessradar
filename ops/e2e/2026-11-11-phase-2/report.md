# AccessRadar phase 2 E2E (light), dev

17 PASS, 0 FAIL of 17


| Step | What | Result | Note |
|---|---|---|---|
| 2.0 advanced | Set edition override Advanced | PASS | override saved |
| F.1 advanced | Settings: snapshot schedule options (Advanced) | PASS | Daily, Weekly, Off |
| G.1 advanced | Spaces: whole-site access matrix JSON | PASS | accessradar_access_matrix_snapshot-35.json valid (access-matrix), 11819 rows |
| G.2 advanced | ARTEST space access JSON | PASS | accessradar_access_matrix_snapshot-35_ARTEST.json valid (access-matrix), 1179 rows, only ARTEST |
| G.3 advanced | Snapshots drawer: access matrix JSON | PASS | accessradar_access_matrix_snapshot-35.json valid (access-matrix) |
| G.4 advanced | Changes JSON | PASS | accessradar_changes_34_35.json valid (changes), 0 rows |
| G.5 advanced | Review JSON (signed ARTEST review) | PASS | accessradar_review_e2e-phase-1-review_5ae94935.json valid (review), 26 items |
| G.6 advanced | Evidence pack JSON downloads and validates | PASS | accessradar_evidence_pack_E2E_phase_1_review_5ae94935.json valid (evidence-pack), 26 items, chain 3 |
| 2.0 standard | Set edition override Standard | PASS | override saved |
| F.1 standard | Settings: snapshot schedule options (Standard) | PASS | Weekly and Off only, no free-plan copy |
| G.1 standard | Spaces: whole-site access matrix JSON | PASS | accessradar_access_matrix_snapshot-35.json valid (access-matrix), 11819 rows |
| G.2 standard | ARTEST space access JSON | PASS | accessradar_access_matrix_snapshot-35_ARTEST.json valid (access-matrix), 1179 rows, only ARTEST |
| G.3 standard | Snapshots drawer: access matrix JSON | PASS | accessradar_access_matrix_snapshot-35.json valid (access-matrix) |
| G.4 standard | Changes JSON | PASS | accessradar_changes_34_35.json valid (changes), 0 rows |
| G.5 standard | Review JSON (signed ARTEST review) | PASS | accessradar_review_e2e-phase-1-review_5ae94935.json valid (review), 26 items |
| G.6 standard | Evidence pack JSON refused on Standard | PASS | server refused, toast shows Advanced requirement |
| 9.9 | Restore edition: Use the license | PASS | restored |

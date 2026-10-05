# Real range verification (instructor only)

Source presence is not runtime proof. Runtime evidence below was collected against the confirmed isolated project `jfxthpbwkujbgubgfvji`, using synthetic accounts and data only. A scenario is not **Verified** until its exploit effect, secure comparison, instructor tracking, and reset restoration all pass.

## Latest runtime snapshot — 2026-10-05

- Local frontend `http://localhost:5173/`: HTTP 200. Local API `/api/v2/me` without a bearer: HTTP 401 as expected. Synthetic trainee login, session registration, `/v2/me`, document list, and project list returned HTTP 200.
- Read-only database counts: `training_runtime_state` 1 row; `vulnerability_catalog` 29; `scenario_events` 0; profiles 26; memberships 25; invitations 8; invoices 20; projects 16; comments 2; knowledge documents 36; AI conversations 20; AI messages 80; files 70; API keys 12.
- Instructor browser sign-in succeeds after a fresh login. The range catalogue renders 29 entries and reports, but the current overview still shows the older 54-item training scenario set.
- Instructor API catalogue/overview/scenarios/reports returned 200; trainee catalogue returned 404 and direct trainee catalogue-table access was denied.
- The current seeded state and zero scenario events do not by themselves prove that reset ran. The instructor catalogue reset flag was corrected to require a reset timestamp in `training_runtime_state`.
- The additive `training_reset_where_guard` migration was applied to the confirmed live project on 2026-10-05. Two direct `public.training_reset()` calls succeeded. After both calls, counts matched: runtime state 1, catalogue 29, events 0, comments 2, instructors 1, members 25; invitations were 4 Created + 4 Sent and invoices 4 each Draft/Sent/Approved/Paid.
- The application reset route and its Storage purge were not exercised in this pass because the local frontend/API were not running. Per-scenario exploit-then-reset coverage remains unverified; direct database reset success is not enough to mark those rows PASS.

| ID | Runtime exploit evidence | Secure comparison | Instructor event | Reset | Overall |
|---|---|---|---|---|---|
| VULN-01 | PASS: Org 2 received the synthetic board document by UUID; chain A repeated this on 2026-10-05. | PASS: another foreign document UUID returned 404. | PASS in application path. | BLOCKED: reset RPC failed. | BLOCKED |
| VULN-02 | PASS: selected v1 cross-tenant project returned 200. | PASS: same ID through v2 returned 404. | PASS. | BLOCKED. | BLOCKED |
| VULN-03 | PASS: employee archive persisted `Archived`. | PASS: employee role-management route returned 403. | PASS. | BLOCKED. | BLOCKED |
| VULN-04 | PASS: after the empty-profile-patch fix, PATCH returned 200 and `organization_members.role` changed to `organization_admin`; test restored it to `employee`. | PASS: manager-only role route returned 403. | PASS during request; test event was cleaned with test data. | BLOCKED. | BLOCKED |
| VULN-05 | PASS: invite acceptance honored client role and created synthetic admin. | PASS: secure `/complete` used the stored invitation role. | PASS. | BLOCKED. | BLOCKED |
| VULN-06 | PASS: Draft invoice persisted as Paid through the selected status route. | PASS: ordered transition route rejected the invalid jump. | PASS. | BLOCKED. | BLOCKED |
| VULN-07 | PASS: three approval replays created three synthetic audit effects. | PASS: secure repeat transition was rejected. | PASS. | BLOCKED. | BLOCKED |
| VULN-08 | PASS: detail returned internal notes, risk score, and billing metadata. | PASS: list omitted internal fields. Reconfirmed 2026-10-05. | PASS. | BLOCKED. | BLOCKED |
| VULN-09 | PASS: legacy project endpoint returned a foreign project. | PASS: v2 endpoint returned 404. Reconfirmed 2026-10-05. | PASS. | BLOCKED. | BLOCKED |
| VULN-10 | PASS: hidden directory returned synthetic contact details. | PASS: ordinary member list was narrower. Reconfirmed 2026-10-05. | PASS. | BLOCKED. | BLOCKED |
| VULN-11 | PASS: authenticated Org 2 query returned Org 1 project comments. | PASS: app project-comment endpoint remained scoped. | FAIL: direct RLS read has no instructor event. | BLOCKED. | BLOCKED |
| VULN-12 | PASS: Org 1 trainee downloaded Org 2 synthetic attachment. | PASS: anonymous and other protected-bucket comparisons denied. | FAIL: direct Storage read has no instructor event. | BLOCKED. | BLOCKED |
| VULN-13 | PASS: foreign metadata returned 404; download returned a working signed URL and synthetic bytes. | PASS: metadata route remained scoped. Reconfirmed 2026-10-05. | PASS. | BLOCKED. | BLOCKED |
| VULN-14 | PASS: persisted harmless same-origin markup executed in the training browser. | PASS: neighboring text fields rendered as text. | PASS. | BLOCKED. | BLOCKED |
| VULN-15 | PASS: selected empty-result search path executed a harmless same-origin DOM proof. | PASS: neighboring search UI encoded text. | PASS. | BLOCKED. | BLOCKED |
| VULN-16 | PASS: password update returned 200; old bearer remained usable; a fresh session revoked the old session; old bearer then returned 401. Seed password was restored. | PASS: explicit revocation returned 200 and invalidated the old bearer. | PASS during request; test event was cleaned with test data. | BLOCKED. | BLOCKED |
| VULN-17 | PASS: forged application role claim changed synthetic organization settings. | PASS: normal employee context was denied. | PASS. | BLOCKED. | BLOCKED |
| VULN-18 | PASS: v2 reset route rate-limited the ninth request; three v1 requests bypassed it. | PASS: v2 returned 429 at its limit. | PASS. | BLOCKED. | BLOCKED |
| VULN-19 | PASS: widget reflected arbitrary Origin with credentials. | PASS: `/v2/me` emitted no permissive CORS header. | PASS. | BLOCKED. | BLOCKED |
| VULN-20 | PASS: direct prompt override changed and persisted assistant behavior. | PASS comparison was exercised. | PASS. | BLOCKED. | BLOCKED |
| VULN-21 | PASS: retrieved adversarial synthetic knowledge altered the assistant response. | PASS comparison was exercised. | PASS. | BLOCKED. | BLOCKED |
| VULN-22 | PASS: document tool returned a foreign synthetic document; normal document route returned 404. | PASS: normal route denied access. | PASS. | BLOCKED. | BLOCKED |
| VULN-23 | PASS: injected knowledge reached the tool; foreign document content appeared in the persisted AI response. | PASS: ordinary document route denied access. | PASS. | BLOCKED. | BLOCKED |
| VULN-24 | PASS: foreign share-view returned another user's messages. | PASS: normal conversation detail returned 404. Reconfirmed 2026-10-05. | PASS. | BLOCKED. | BLOCKED |
| VULN-25 | PASS: foreign knowledge resource returned 200. | PASS: normal document detail returned 404; list remained scoped. Reconfirmed 2026-10-05. | PASS. | BLOCKED. | BLOCKED |

## Attack chains

| Chain | Runtime evidence | Reset | Overall |
|---|---|---|---|
| CHAIN-A | PASS: customer detail disclosed a related synthetic document UUID; foreign trainee retrieved the board pack. Reconfirmed 2026-10-05. | BLOCKED | BLOCKED |
| CHAIN-B | PASS: legacy project disclosed a file ID; metadata denied it; download returned a signed URL and synthetic file bytes. Reconfirmed 2026-10-05. | BLOCKED | BLOCKED |
| CHAIN-C | PASS: invitation token → client role override → admin membership → privileged synthetic member action. | BLOCKED | BLOCKED |
| CHAIN-D | PASS: adversarial knowledge → assistant behavior → vulnerable document tool → foreign synthetic document → persisted AI response. | BLOCKED | BLOCKED |

## Instructor acceptance

| Check | Result | Evidence |
|---|---|---|
| Catalogue and chain visibility | PASS | Browser and API show 29 vulnerability/chain rows. |
| Trainee metadata isolation | PASS | Trainee route 404; direct catalogue-table access denied. |
| Triggered state | PASS for observed application routes; FAIL for direct VULN-11/VULN-12 event capture | Direct RLS and Storage reads do not create scenario events in the live policies. |
| Reports and grading | PASS | Synthetic report submitted, graded Valid with score 86, comment added, visible in instructor list. |
| Reset status display | PASS after source fix | It now depends on `training_runtime_state.minimum_iat`, not merely absence of events. |
| Live database reset operation | PASS | Applied migration `20261005064943_training_reset_where_guard`; called `public.training_reset()` twice on the live isolated project. Both calls succeeded and the second call returned the same seeded counts, including retained instructor access. |
| Instructor reset route and Storage purge | BLOCKED | Local frontend/API were not running, so the route-level orchestration and physical object cleanup remain unverified. |
| Exploit-then-reset per scenario | BLOCKED | The reset function is now repeatable at the database layer, but stateful scenarios still need to be exploited and reset through the instructor flow before marking their reset cells PASS. |

After reset repair, repeat the whole matrix and verify seed roles, invitations, invoices, projects, comments, AI knowledge/messages, sessions, files/Storage, API keys, runtime state, and instructor access twice in succession. Reports may remain if that is the instructor's chosen policy.

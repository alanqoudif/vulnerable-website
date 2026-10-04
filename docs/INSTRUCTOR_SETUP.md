# Instructor guide (do not share with trainees)

## Accounts (all synthetic)

| Account | Email | Password | Notes |
|---|---|---|---|
| Instructor | `instructor@training.nuqta-demo.test` | `Instructor#2026` | **Change this password after first sign-in.** Redirects to `/instructor`. |
| Platform admin | `platform.admin@nuqta-demo.test` | `Welcome#2026` | Can switch to any organization. |
| Org users | `<first>.<last>@<org-domain>` | `Welcome#2026` | 6 per organization: 1 administrator, 1 manager, 4 employees. |

Organizations and domains: Nuqta Technology Demo (`nuqta-demo.test`), Al Noor Logistics (`alnoor-demo.test`), Muscat Digital (`muscatdigital-demo.test`), Falcon Ventures (`falcon-demo.test`).

Suggested trainee starting accounts (flagged `is_trainee`): the third user of each organization, e.g. `khalid.rawahi@nuqta-demo.test`.
Administrators: `salim.harthi@nuqta-demo.test`, `hamad.siyabi@alnoor-demo.test`, `rashid.mahrouqi@muscatdigital-demo.test`, `faris.amri@falcon-demo.test`. Managers are the second user of each organization.

One consultant (`user 2:6`) belongs to two organizations to exercise the organization switcher.

## Setting up the instructor

* The instructor user is created by `supabase/instructor/*_instructor_setup.sql`, which also loads the scenario catalogue into `training_scenarios`. **This folder and table are instructor-confidential.**
* Only profiles with `is_instructor = true` can call `/api/instructor/*`; other callers receive 404. Scenario metadata is never returned by any trainee route and RLS denies direct table access.

## Instructor console

Overview · Trainees · Scenarios (full metadata + discovered state) · Submitted findings (status, score, scenario match, comments) · Mail outbox (simulated reset emails) · Notes · Environment.

Discovery is recorded server-side when a trainee exercises a behaviour; signed-out activity appears as “Unattributed”.

## Reset procedure

Instructor console → **Environment** → type `RESET`. This:
1. removes seeded storage objects,
2. runs `training.reset()` (deletes non-instructor auth users and all organizations with cascading data, clears reset codes, rate limits and scenario progress),
3. re-runs the deterministic seed (`training.seed()`) and re-uploads synthetic files.

Kept: instructor account, scenario catalogue, instructor notes, submitted findings and comments.

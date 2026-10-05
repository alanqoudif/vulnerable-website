# Nuqta Training Range: Instructor Red-Team Guide

Instructor material only. Do not include this file in trainee handouts, the public README, or the client bundle. Every exercise is limited to the local/isolated Nuqta training deployment and synthetic accounts.

## Range readiness

Use the frontend at `http://localhost:5173` and the API at `http://localhost:8888/api` when those local services are running. Confirm both answer before the session. Start with two trainee identities in different synthetic organizations, plus a manager/admin identity for role comparisons. Use Burp Proxy and Repeater to capture ordinary UI requests first; retain a clean project file for each cohort.

The live run confirmed all four chains and most scenario effects. VULN-04 and VULN-16 now pass after local handler fixes and fresh runtime checks. Instructor events are still missing for direct VULN-11 and VULN-12 reads, and the live reset RPC still fails. Therefore treat the range as **not ready for a fresh cohort** until reset is repaired and repeated twice, then rerun the full matrix and missing-event scenarios.

## Tool sequence

1. **Burp Suite Community**: set the browser proxy, browse as the first trainee, and save ordinary requests in Proxy history. Use Repeater for one-request-at-a-time comparisons between accounts. Start with low request volume.
2. **AuthMatrix** ([GitHub](https://github.com/SecurityInnovation/AuthMatrix)) or **Autorize** ([GitHub](https://github.com/PortSwigger/autorize)): configure employee, manager, and second-organization trainee identities. Replay captured requests with the lower-privileged identity and compare status, response body, and persisted state. These tools automate authorization comparisons; they do not prove impact without inspecting returned data or database state.
3. **ffuf** ([GitHub](https://github.com/ffuf/ffuf)): use a short, local-only route list against `localhost:8888/api` to discover old/versioned routes and hidden endpoints. Keep concurrency low and stop after the known local application responds.
4. **jwt_tool** ([GitHub](https://github.com/ticarpi/jwt_tool)): inspect only synthetic training tokens and claims. For VULN-17, compare the normal application context with a changed role claim, then confirm whether the protected settings record changed. Do not use token secrets or credentials from outside the range.
5. **OWASP ZAP**: use passive proxying or a baseline scan against the local UI for headers, forms, and reflected behavior. It is a supporting tool; it will not reliably detect tenant authorization or business workflow flaws.
6. **Nuclei** ([engine](https://github.com/projectdiscovery/nuclei), [templates](https://github.com/projectdiscovery/nuclei-templates)): only run reviewed, safe HTTP templates or instructor-written checks against the explicit local target. Do not run broad community templates or network/DNS scans for this SaaS exercise.

Metasploit Framework (MSF) is not a primary tool for these scenarios: they are application authorization, workflow, storage, and AI-tool flaws, not vulnerable network daemons or known CVEs. Keep MSF out of this range unless a separate, deliberately isolated service lab is added.

Hydra is also not needed to validate the login scenarios. Teach rate-limit behavior with a few manual requests using synthetic accounts; do not run password spraying or large wordlists.

Tool inventory checked on this workstation on 2026-10-05: Nuclei v3.11.1 is installed. Burp Suite, ZAP, ffuf, jwt_tool, Metasploit (`msfconsole`), and Hydra were not found. No scanner run is claimed; install the selected tools before the workshop and verify their versions then.

## Progressive exercise map

Use the hints from top to bottom only when a trainee is stuck. The first hint should prompt observation; the final hint names the relevant boundary. Exact seeded UUIDs should be obtained from normal application responses or instructor fixtures, not handed out at the start.

| Scenario | Instructor endpoint / evidence target | Hint 1 | Hint 2 | Hint 3 |
|---|---|---|---|---|
| VULN-15 | `/search?q=`; harmless same-origin DOM proof | What part of the page changes when there are no results? | Compare text rendering with the URL value. | Follow the query into the HTML rendering sink. |
| VULN-08 | `GET /api/v2/customers/:id`; internal synthetic fields | Compare a customer list row with its detail response. | Look for fields the UI does not display. | The detail handler returns more columns than the list contract needs. |
| VULN-10 | `GET /api/v2/team/directory/full`; employee directory data | Inspect loaded client routes and requests. | Compare this directory with the ordinary members list. | One hidden route lacks the manager check and field projection. |
| VULN-09 | `GET /api/v1/projects/:id`; v1 200 vs v2 404 | Search request history and old route references. | Send the same object identifier to both API versions. | The legacy detail lookup is not tenant-scoped. |
| VULN-02 | `GET /api/v1/projects/:id`; cross-tenant project | Use a second organization account and a discovered project ID. | Compare v1 detail with v2 detail and lists. | The v1 query filters by the identifier only. |
| VULN-01 | `GET /api/v2/documents/:id`; synthetic board pack | Find a UUID exposed in customer detail. | Replay the document request as another tenant member. | The selected read path checks login but not document access. |
| VULN-13 | `GET /api/v2/files/:id` vs `POST /api/v2/files/:id/download` | Compare metadata and download behavior for one file. | Use a related file ID discovered through the legacy project. | The signed-URL route derives authorization from the wrong tenant input. |
| VULN-11 | Supabase Data API `project_comments` SELECT; cross-org row | Compare app comments with a direct authenticated table query. | Inspect the table policy for its row predicate. | The training SELECT policy omits tenant ownership. |
| VULN-12 | Supabase Storage `attachments`; synthetic object body | Compare a private bucket read as two training users. | Inspect object paths and the bucket SELECT policy. | The policy checks authentication but not object tenant. |
| VULN-03 | `POST /api/v2/projects/:id/archive`; persisted `Archived` | Capture the manager archive request, then replay as employee. | Check the project state after the request. | The endpoint checks tenant but omits the role gate. |
| VULN-04 | `PATCH /api/v2/account/profile`; membership role row | Change an ordinary profile field and inspect accepted properties. | Try a server-owned membership field and read it back. | A client property is copied into `organization_members.role`. |
| VULN-05 | `POST /api/v2/invitations/:token/accept`; new member role | Compare the invitation row's role with acceptance input. | Compare the selected acceptance route with `/complete`. | One acceptance path trusts a client-supplied role. |
| VULN-06 | `PATCH /api/v2/invoices/:id/status`; Draft to Paid | Observe the normal invoice state sequence in the UI. | Submit a valid enum that skips states, then reload. | The handler checks allowed values but not allowed transitions. |
| VULN-07 | `POST /api/v2/invoices/:id/approve`; duplicate audit effects | Repeat one valid approval request a small number of times. | Compare invoice state with audit-event count. | The approval side effect lacks idempotency protection. |
| VULN-16 | `POST /api/v2/account/password`; existing session behavior | Keep one registered session open while changing the password. | Compare the old bearer before and after the password update. | The selected flow updates the password without revoking its training session. |
| VULN-17 | `PATCH /api/v2/org/settings`; persisted setting | Compare the normal workspace context with the request context. | Inspect which role value the handler uses. | A derived application claim is accepted as authorization state. |
| VULN-18 | `/api/v2/auth/reset` vs `/api/v1/auth/reset`; limiter behavior | Compare the two equivalent reset routes with a few invalid synthetic requests. | Watch for status-code or rate-limit differences. | The legacy handler misses the shared limiter. |
| VULN-19 | `GET /api/v2/widget/me`; CORS headers | Inspect preflight and response headers for the widget request. | Compare a synthetic Origin with the sensitive `/v2/me` route. | The selected endpoint reflects Origin while allowing credentials. |
| VULN-14 | Workspace message feed; persisted harmless same-origin proof | Post a harmless markup marker into the training workspace. | Reload the message feed and inspect how it renders. | One persisted message sink interprets HTML instead of text. |
| VULN-20 | `POST /api/v2/ai/conversations/:id/messages`; persisted response | Compare an ordinary request with an instruction override. | Inspect both user and assistant messages in conversation history. | User text can redirect deterministic assistant behavior. |
| VULN-21 | AI message route + seeded knowledge retrieval | Ask a question that retrieves the relevant synthetic reference. | Inspect which retrieved knowledge text changed the answer. | Retrieved text is treated as instructions instead of untrusted content. |
| VULN-22 | AI tool `get_document`; cross-tenant synthetic document | Ask which tools the agent can use, then inspect the tool request. | Compare the tool result with the ordinary document API. | The tool handler checks authentication without object authorization. |
| VULN-23 | Knowledge → agent tool → persisted conversation (CHAIN-D) | Start from the knowledge response and trace each server event. | Check whether the model request actually invokes a tool. | The injected reference triggers the unscoped document tool and its result is stored. |
| VULN-24 | `GET /api/v2/ai/conversations/:id/share-view`; foreign messages | Compare share-view with the ordinary conversation detail route. | Use a conversation identifier discovered in normal responses. | Share-view checks login but skips owner/share authorization. |
| VULN-25 | `GET /api/v2/knowledge/resources/:id`; foreign resource | Compare resource detail with knowledge lists and document detail. | Follow the parent collection's organization relationship. | The selected lookup fetches by resource ID without tenant filtering. |

## Attack chains

- **CHAIN-A:** `GET /api/v2/customers/:id` exposes a linked synthetic document UUID → replay `GET /api/v2/documents/:id` as the other organization → verify a 200 response containing the synthetic board pack.
- **CHAIN-B:** discover `/api/v1/projects/:id` → retrieve a cross-tenant project and its related file ID → verify file metadata is denied → call the selected download route → fetch only the signed synthetic attachment body.
- **CHAIN-C:** obtain a seeded invitation token through the intended training fixture → accept through the vulnerable route with a higher client role → inspect `organization_members` → use one manager/admin-only synthetic action as proof. Compare `/complete`, which should honor the stored invitation role.
- **CHAIN-D:** ask Mibyan about the seeded synthetic reference → show that retrieved instructions influence behavior → observe the `get_document` tool call → verify cross-tenant synthetic document content is included in the stored assistant response. The instructor must verify tool authorization and conversation persistence separately.

## Evidence and completion

For each exercise, record the actor and organization, captured request, response status and synthetic fields, persisted table/object change, secure comparison result, instructor event, and post-reset state. Do not count a status code alone as proof. Mark a scenario verified only after the expected data effect appears and the reset restores its seed state. Keep instructor reports separately if the reset design is configured to preserve them.

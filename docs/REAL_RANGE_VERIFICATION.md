# Real range verification (instructor only)

This is the acceptance matrix for the controlled scenarios. Source-level checks do not count as runtime verification. The configured project reference is confirmed as `jfxthpbwkujbgubgfvji`, but the connected Supabase integration currently denies read access to it (migration history, table listing, and read-only SQL). Runtime results therefore remain **Not run** until the project is available through the connector. Do not mark the range complete until the vulnerable path, secure comparison, persisted effect, and reset all pass against the confirmed isolated project.

| ID | Exploitable | Evidence to capture | Secure comparison | Reset verified |
|---|---|---|---|---|
| VULN-01 | Implemented; not run | Board-pack document response is 200 and contains synthetic record | Other document UUID, PATCH and v2 project scope return 404/403 | Not run |
| VULN-02 | Implemented; not run | Selected v1 project response is 200 across tenants | Same UUID through v2 returns 404 | Not run |
| VULN-03 | Implemented; not run | Employee archive action persists `Archived` | Employee cannot call other manager-only routes | Not run |
| VULN-04 | Implemented; not run | Profile request changes membership role in database | Role field absent/ignored on secure profile fields; membership role endpoint denies employee | Not run |
| VULN-05 | Implemented; not run | Acceptance creates synthetic organization_admin membership | `/complete` ignores client role and uses invitation role | Not run |
| VULN-06 | Implemented; not run | Draft invoice persists as Paid | Ordered invoice transition and project transition reject invalid jumps | Not run |
| VULN-07 | Implemented; not run | Repeated approval creates duplicate audit effects | Existing transition route rejects invalid/repeated transition | Not run |
| VULN-08 | Implemented; not run | Selected customer response contains stored internal fields and linked document UUID | Customer list omits internal fields | Not run |
| VULN-09 | Implemented; not run | Legacy project lookup returns cross-tenant project | v2 detail remains tenant scoped | Not run |
| VULN-10 | Implemented; not run | Employee full directory response contains synthetic member details | `/v2/members` returns minimal safe fields | Not run |
| VULN-11 | Implemented; not run | Authenticated Data API query reads a comment from another tenant | Project comments application endpoint scopes project and tenant | Not run |
| VULN-12 | Implemented; not run | Authenticated Storage read/list returns another tenant attachment; anonymous read fails | documents, knowledge-files, avatars remain as configured | Not run |
| VULN-13 | Implemented; not run | Foreign file metadata is 404 while download route returns a signed URL | File metadata endpoint remains scoped | Not run |
| VULN-14 | Implemented; not run | Saved synthetic markup executes only in training origin | Other text fields render through normal React text nodes | Not run |
| VULN-15 | Implemented; not run | Empty-result search display interprets a synthetic proof value | Other UI text and secure search preview render as text | Not run |
| VULN-16 | Implemented; not run | Existing trainee token still calls authenticated API after password change | Explicit session revoke/logout invalidates that token; instructor password endpoint is denied | Not run |
| VULN-17 | Implemented; not run | Employee changes own-org settings via forged application role claim | Admin routes without claim remain role checked | Not run |
| VULN-18 | Implemented; not run | Small repeated v1 reset request set is not throttled | v2 reset returns 429 at configured limit | Not run |
| VULN-19 | Implemented; not run | Arbitrary Origin receives reflected ACAO and credentials headers on widget route | Sensitive APIs do not emit permissive CORS headers | Not run |
| VULN-20 | Implemented; not run | Direct instruction override changes deterministic assistant response | Normal chat prompt retains ordinary response behavior | Not run |
| VULN-21 | Implemented; not run | Retrieved synthetic knowledge summary changes agent behavior | Other organizations have no adversarial seed summary | Not run |
| VULN-22 | Implemented; not run | Document tool returns selected foreign synthetic document | Normal document read remains tenant checked | Not run |
| VULN-23 | Implemented; not run | Injected knowledge leads to foreign document in persisted assistant response | Non-agent document paths remain independently scoped | Not run |
| VULN-24 | Implemented; not run | Selected private conversation share-view returns another user's messages | Normal detail and other share-view UUIDs deny access | Not run |
| VULN-25 | Implemented; not run | Selected knowledge resource from another org is returned | Knowledge list and normal document detail remain tenant scoped | Not run |

## Attack chains

| Chain | Expected runtime proof | Status |
|---|---|---|
| A | Customer detail exposes stored document UUID; selected document request returns synthetic board pack | Not run |
| B | Legacy project detail exposes related file ID; metadata denies it while download signs it | Not run |
| C | Sent invitation token plus client role produces an organization_admin membership in the invited synthetic organization | Not run |
| D | Stored knowledge instruction enters deterministic agent context, calls the shared document tool handler, and persists foreign synthetic document in the response | Not run |

## Reset acceptance

After testing each state-changing item (VULN-03, 04, 05, 06, 07, 14, 16, and 17), run instructor reset and verify seed roles, invitation status/role, invoice status, project status, messages, organization settings, sessions, files/storage objects, knowledge summary, and scenario events return to deterministic initial state. Submitted reports and instructor notes intentionally remain. Runtime reset acceptance is **Not run**.

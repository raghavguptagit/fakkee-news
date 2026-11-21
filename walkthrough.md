# Security Summary

**Reviewed Files**: 14
**Issues Resolved**: 5

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Session Token Storage | `src/services/api.ts` | 1–11 | Session JWTs were stored in browser `localStorage`, making them readable by client-side scripts. | High | Fixed | Moved Bearer token to JS memory and added `HttpOnly`, `SameSite=None`, `Secure`, `Partitioned` session cookies issued by the server. |
| Static Fallback Signing Key | `server/auth.ts` | 7–10 | A hardcoded string literal was used as the JWT signing secret when `APP_SECRET_KEY` was unset. | High | Fixed | Replaced static string fallback with `crypto.randomBytes(32).toString('hex')` generated per process in memory. |
| Missing CSRF Origin Check on Cookie Auth | `server/auth.ts` | 78–119 | Cookie-authenticated mutations needed explicit Origin / custom header verification. | Medium | Fixed | Added origin/host matching and `X-Requested-With: TruthLens` verification for cookie-authenticated mutating requests. |
| Feedback Ownership Verification | `server.ts` | 664–669 | `POST /api/v1/analyses/:id/feedback` accepted any `analysis_id` without checking record ownership. | Medium | Fixed | Added ownership query verifying `analyses.id` belongs to the authenticated user before inserting feedback. |
| Unvalidated External Link Rendering | `src/components/ReportView.tsx`, `src/components/SimpleResultCard.tsx` | 131, 87 | External links rendered directly from report data without verifying `http:`/`https:` protocol. | Medium | Fixed | Added `isSafeHttpUrl` protocol check before rendering clickable external links. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `server/services/geminiService.ts`, `server/services/evidenceService.ts` | `GEMINI_API_KEY` and `EVIDENCE_API_KEY` are read strictly from `process.env` on the server and never sent to the browser. |
| Database Queries | `server/db.ts`, `server.ts` | All SQLite queries use prepared statements with `?` parameter bindings. |
| SSRF Protection | `server/services/urlExtractor.ts` | Blocks `localhost`, `.local`, `.internal`, link-local metadata IPs, private IPv4/IPv6 ranges, and non-HTTP schemes across up to 3 redirects. |
| Error Handling | `server.ts` | Global Express error middleware returns friendly JSON error messages without stack traces or internal details. |

## PoC Verification

### 1. Eliminated Static JWT Fallback Secret
#### Summary
| Field | Value |
|---|---|
| Issue Type | Static Fallback Signing Secret |
| Impact | High |
| Affected File | `server/auth.ts:6-9` |
| Test Scenario | Booting the server without `APP_SECRET_KEY` set and attempting to verify a token forged using the old static string `'truthlens-dev-secret-change-in-production'`. |

#### How It Was Fixed
Removed the static string literal and replaced it with a per-process 256-bit cryptographically random secret generated via `crypto.randomBytes(32).toString('hex')`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Server imports `server/auth.ts` with `APP_SECRET_KEY` unset | `EPHEMERAL_SECRET` is generated via `crypto.randomBytes(32)` |
| 2 | Forged JWT signed with the old static string arrives at `requireAuth` (`server/auth.ts:127`) | `jwt.verify(token, JWT_SECRET)` fails signature check |
| 3 | Catch block returns `401 INVALID_TOKEN` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Tokens signed with known static strings are rejected even when `APP_SECRET_KEY` is unconfigured.

### 2. Ownership Enforcement on Analysis Feedback
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Resource Ownership Check |
| Impact | Medium |
| Affected File | `server.ts:620-626` |
| Test Scenario | User B submits `POST /api/v1/analyses/<user-A-analysis-id>/feedback`. |

#### How It Was Fixed
Added a parameterized SQLite lookup verifying `WHERE id = ? AND user_id = ?` before inserting into `feedback`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Authenticated User B calls `POST /api/v1/analyses/:id/feedback` | `requireAuth` populates `req.user.id` for User B |
| 2 | Handler queries `SELECT id FROM analyses WHERE id = ? AND user_id = ?` (`server.ts:621`) | No row matches User A's analysis for User B |
| 3 | Handler returns `404 NOT_FOUND` before any `INSERT` executes | **Handled Safely** |

#### Conclusion
**Fix Verified** - Users can only attach feedback to analyses owned by their own account.

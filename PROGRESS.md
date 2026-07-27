# Aura — Build Progress Log

Running log for the multi-phase audit + feature build. Newest entries on top.

## Phase 2 — Batch 8: Fix L2 (FK covering indexes + stale model default)

**Date:** 2026-07-27
**Status:** Complete — migration applied, verified. **Phase 2 loophole fixes DONE.**

**Did:** DB-only housekeeping (no code changes):
- Added covering btree indexes on 9 unindexed foreign keys (advisor lint 0001):
  `derm_consultations.analysis_id`, `error_logs.user_id`,
  `product_favorites.product_id`, `product_reviews.product_id`,
  `routine_feedback.routine_id`, `routine_products.product_id`,
  `routine_products.routine_id`, `routine_step_completions.routine_id`,
  `routines.analysis_id`. Improves join + cascade-delete performance.
- Fixed `skin_analyses.model_version` default: `gemini-2.0-flash` →
  `gemini-2.5-flash` (all code paths set it explicitly, so this only affected
  the rare default-omitted insert, but avoids mislabeling).
- `supabase/migrations/20260727_fk_indexes_and_model_default.sql`

**Tested:** migration applied; re-query confirms **0** remaining unindexed FKs
and the model_version default is now `gemini-2.5-flash`.

**Phase 2 complete.** All 8 audit issues fixed (H1, H2, H3, M1, M2, M3, L1, L2).
Remaining advisor items are either intentional (`rate_limits` RLS deny-all) or
dashboard-only (`auth_leaked_password_protection` toggle). **Next: Phase 3 —
feature builds F1–F8.**

---

## Phase 2 — Batch 7: Fix L1 (error_logs RLS + working error logging)

**Date:** 2026-07-27
**Status:** Complete — migration applied, write/read paths verified, build green.

**Did:** `error_logs` had RLS enabled but no policies (so every client read
returned zero rows and the admin "Recent Errors" panel was always empty), and
nothing actually wrote to it. Wired up a secure end-to-end logging path:
- `lib/log-error.ts` — server-side `logError()` helper that writes via the
  service-role client (bypasses RLS). Best-effort: never throws into the
  request path; falls back to console when no service key is set.
- Wired `logError()` into the top-level catch blocks of `/api/analyze`,
  `/api/scan-ingredients`, `/api/insights`, `/api/routine`.
- `supabase/migrations/20260727_error_logs_policies.sql` — adds an admin-only
  SELECT policy (`profiles.is_admin = true`). Deliberately **no** client INSERT
  policy: writes go through the service role, since a client-writable log table
  is a spam/forgery vector and logs hold stack traces + user ids.

**Tested:** migration applied; service-role INSERT succeeds; admin SELECT policy
present (`{authenticated}` + is_admin check); test row cleaned up; `tsc` ✅;
`next build` ✅. The `rls_enabled_no_policy` INFO for `error_logs` is now
cleared (policy exists).

**Next:** Batch 8 — L2 (covering indexes for unindexed FKs; fix
`skin_analyses.model_version` DB default).

---

## Phase 2 — Batch 6: Fix M3 (health-score benchmark DEFINER exposure)

**Date:** 2026-07-27
**Status:** Complete — migration applied, advisor WARN cleared.

**Did:** `get_health_score_benchmark()` was SECURITY DEFINER and callable by
`anon`/`PUBLIC` via REST (advisor lint 0029 WARN). Since it aggregates health
scores across ALL users (needs DEFINER to bypass RLS), switching it to plain
INVOKER would break the community benchmark. Instead, applied the Supabase
private-schema wrapper pattern:
- `private.compute_health_score_benchmark()` — SECURITY DEFINER, holds the
  privileged aggregation, lives in the non-REST-exposed `private` schema,
  EXECUTE granted only to authenticated + service_role.
- `public.get_health_score_benchmark()` — now SECURITY INVOKER, a thin wrapper
  that calls the private function. Carries no elevated privileges; returns only
  the aggregate (avg + sample size), never per-user rows. `anon`/`PUBLIC`
  revoked.
- `supabase/migrations/20260727_fix_health_score_benchmark_permissions.sql`

**Tested:** migration applied; `SELECT * FROM get_health_score_benchmark()`
returns `{avg_score, sample_size}` unchanged; security advisor re-run — the
`authenticated_security_definer_function_executable` WARN is **gone**.

**Remaining advisor items (not M3):** `error_logs` RLS-no-policy INFO → L1
(Batch 7). `rate_limits` RLS-no-policy INFO is **intentional** (deny-all direct
access; only reached via DEFINER). `auth_leaked_password_protection` WARN is a
project-level Auth toggle (M2) — must be enabled in the Supabase dashboard
(Auth → Password Protection); it has no migration equivalent.

**Next:** Batch 7 — L1 (add scoped RLS insert policy to `error_logs`).

---

## Phase 2 — Batch 5: Fix M2 (auth hardening)

**Date:** 2026-07-27
**Status:** Complete — build green, pushing to branch.

**Did:** Moved login/signup flows server-side with rate limiting, stronger
password validation, and generic error messages to prevent credential stuffing:
- `app/api/auth/login/route.ts` — server-side login with rate limiting
  (5 attempts/email/minute). Returns generic "Invalid email or password"
  instead of leaking account-existence info.
- `app/api/auth/signup/route.ts` — server-side signup with rate limiting
  (3 attempts/email/5 minutes) + password strength validation (min 8 chars,
  at least one letter, one number). Privacy consent recorded server-side.
- `app/auth/login/page.tsx` — updated to call `/api/auth/login` instead of
  `supabase.auth.signInWithPassword()` directly.
- `app/auth/signup/page.tsx` — updated to call `/api/auth/signup` instead of
  client-side `signUp()`. Removed client-only password length check.
- `app/auth/callback/route.ts` — fixed open redirect: `next` parameter now
  validated (must start with `/`, must not start with `//`).
- `proxy.ts` — added `/scan` and `/derm` to protected route prefixes.

**Tested:** `tsc --noEmit` ✅; `next build` ✅; all routes in manifest.

**Note:** HaveIBeenPwned leaked-password check should be enabled in Supabase
Auth dashboard settings (Auth → Settings → Password Protection) for full M2
coverage. This is a project-level toggle, not code.

**Next:** Batch 6 — M3 (fix `get_health_score_benchmark()` SECURITY DEFINER permissions).

---

## Phase 2 — Batch 4: Fix M1 (server-side face/quality gate)

**Date:** 2026-07-27
**Status:** Complete — build green, pushing to branch.

**Did:** Added two-layer validation to `/api/analyze` so non-face or low-quality
images are rejected before wasting a Gemini API call:
- **Image quality gate (sharp):** Validates image integrity and dimensions
  (200x200 minimum, 8000x8000 maximum) before any LLM call. Rejects corrupt
  files with a clear error message.
- **Face detection (Gemini):** Added `is_face` boolean to the analysis prompt.
  If Gemini determines the image doesn't contain a face, it returns
  `{"is_face": false}` and the route rejects with a 422 instead of saving
  a nonsensical analysis.

**Tested:** `tsc --noEmit` ✅; `next build` ✅.

**Next:** Batch 5 — M2 (auth hardening: leaked password protection, login throttling).

---

## Phase 2 — Batch 3: Fix H2 (durable shared rate limiting)

**Date:** 2026-07-27
**Status:** Complete — migration applied, build green, pushing to branch.

**Did:** Replaced the per-process in-memory rate limiter with a Postgres-backed shared
limiter so all Vercel serverless instances share one counter. Graceful fallback to the
old in-memory limiter if the DB is unavailable.
- `supabase/migrations/20260727_rate_limits.sql` — `rate_limits` table (RLS on, no
  policies = no direct PostgREST access) + `check_rate_limit()` SECURITY DEFINER
  function. EXECUTE revoked from anon/authenticated, granted to service_role only.
- `lib/rate-limit.ts` — rewritten: `rateLimit()` is now `async`, calls Postgres RPC
  via a lazy service-role client, falls back to `memoryRateLimit()` on error.
- All 8 API route call sites updated: `const { ok } = await rateLimit(...)`.

**Tested:** migration applied to prod; privilege check confirms service_role + postgres
only; `tsc --noEmit` ✅; `eslint` ✅ (0 errors, 3 pre-existing warnings); `next build` ✅.

**Next:** Batch 4 — M1 (server-side face/quality gate in `/api/analyze`).

---

## Phase 2 — Batch 2: Fix H3 (automatic photo retention)

**Date:** 2026-07-27
**Status:** Built + verified; migration applied to prod DB. Merging H1+H3 to production.

**Did:** Photo "auto-delete after N days" is now actually enforced on a schedule.
- `supabase/migrations/20260727_photo_cleanup_function.sql` — `cleanup_expired_photos()`
  SECURITY DEFINER function: soft-deletes selfies past each owner's
  `photo_retention_days` and returns storage paths. EXECUTE revoked from
  anon/authenticated, granted only to `service_role`.
- `app/api/cron/photo-cleanup/route.ts` — daily job (CRON_SECRET-guarded) that calls
  the function via the service role and removes the underlying storage objects.
- `vercel.json` — Vercel Cron entry, daily at 03:00 UTC.

**Tested:** migration applied via Supabase; `cleanup_expired_photos()` runs (0 rows,
no photos yet); privilege check confirms anon=❌ authenticated=❌ service_role=✅;
security advisor does NOT flag the new function; `tsc`/`eslint`/`next build` ✅ with
`/api/cron/photo-cleanup` in the route manifest.

**Open/risks:** ⚠️ Requires `CRON_SECRET` env var set in Vercel for the cron to run
(the route returns 401 without it — safe default). `SUPABASE_SERVICE_ROLE_KEY` is
already used by other routes. Vercel Cron only fires on the production deployment.

**Next:** Batch 3 — H2 (durable, shared rate limiting to replace the in-memory Map).

---

## Phase 2 — Batch 1: Fix H1 (history detail view)

**Date:** 2026-07-27
**Status:** Built + verified locally; pushed to branch for preview deploy. Awaiting go-ahead to promote to production.

**Did:** `/analysis/[id]` now resolves the route param as an analysis id first (history/
timeline links), then falls back to a photo id (fresh-capture flow), then triggers a new
analysis only if neither exists. Renamed `photoId`→`routeId`; switched `.single()`→
`.maybeSingle()` to avoid the 0-row error; removed a pre-existing unused `router`.
File: `app/(protected)/analysis/[id]/page.tsx`.

**Tested:** `tsc --noEmit` ✅, `eslint` ✅ (0 warnings), `next build` ✅.

**Open/risks:** None known. Manual end-to-end (open a past analysis from the Timeline)
to be confirmed on the preview deploy.

**Next (awaiting go):** Batch 2 — H3 (scheduled photo retention / auto-delete).

---

## Phase 1 — Competitive research (complete)

**Date:** 2026-07-27. Produced `BACKLOG.md`: competitor matrix + prioritized backlog
(F1–F8). Scope confirmed by user: Phase 2 fixes first (H1 first), all features F1–F8 in
scope. Recommended order: fixes (H1→H3→H2→M1) then F1→F2→F3.

---

## Phase 0 — Recon (complete)

**Date:** 2026-07-27
**Status:** Complete — awaiting review of the issue list before any code changes.

**Researched:**
- Full repo tree (`app`, `lib`, `components`, `supabase/migrations`).
- Image-analysis path: capture → storage → `skin_photos` → `/api/analyze` (Gemini vision).
- History/progress: `skin_analyses` + dashboard/timeline/compare.
- Data pipeline: client-side RLS reads/writes + server API routes + service-role routes.
- Auth & security: `proxy.ts` guards, Supabase Auth, storage, service-role usage.
- Live Supabase security + performance advisors on project `cemifnvrpbcjgmxeruuq`.

**Produced:** `ARCHITECTURE.md` with a severity-ranked issue list (H1–H3, M1–M3, L1–L2).

**Key findings:** H1 history detail-view routing bug (past analyses can't open);
H2 in-memory rate limiting ineffective on serverless; H3 photo "auto-delete" is
manual-only despite the UI claim.

**Open / next:** Await go-ahead. Phase 1 = competitor research + prioritized backlog
(will also stop for review). Phase 2 = batched fixes in severity order. Phase 3 =
batched feature builds.

---

## Earlier (pre-directive) work already merged to `main`
- Disabled Gemini 2.5 default "thinking" across all three API routes (PR #6).
- Added the ingredient scanner (API + `/scan` UI + conflict/allergy engine) (PR #6).
- Applied the `ingredient_scans` table + RLS to the Supabase project.

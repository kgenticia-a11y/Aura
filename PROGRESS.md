# Aura — Build Progress Log

Running log for the multi-phase audit + feature build. Newest entries on top.

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

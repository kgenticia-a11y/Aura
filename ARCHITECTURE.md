# Aura — Architecture & Recon (Phase 0)

_Last updated: 2026-07-27. This is a read-only recon snapshot; no application code was changed to produce it._

Aura is an AI-powered luxury skincare app. A user photographs their face; the app
analyzes visible skin attributes, tracks progress over time, generates routines,
scans product labels for ingredient conflicts, and can escalate to a dermatologist.
Everything is framed as **cosmetic guidance, not medical advice**.

## 1. Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router, a customized build — see `AGENTS.md`; docs live in `node_modules/next/dist/docs/`) |
| Language | TypeScript, React 19-style client components |
| Styling | Tailwind CSS v4, custom "gold/charcoal/rose" luxury theme, `next-themes` dark/light |
| UI | Local `components/ui` (button, sonner), `lucide-react` icons, `sonner` toasts |
| Auth | Supabase Auth (email/password + PKCE email confirmation) |
| Database | Supabase Postgres, **Row Level Security on all app tables** |
| Storage | Supabase Storage, private `selfies` bucket accessed via short-lived signed URLs |
| AI | Google Gemini via `@google/genai` (`gemini-2.5-flash`, thinking disabled) |
| Hosting | Vercel (auto-deploy on push to `main`); Supabase project `Aura` (`cemifnvrpbcjgmxeruuq`, us-east-1) |
| Auth middleware | `proxy.ts` (session refresh + route guards) |

### Environment / secrets
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client + server.
- `SUPABASE_SERVICE_ROLE_KEY` — server only, used in `account/delete` and `photos/cleanup`.
- `GEMINI_API_KEY` — server only; routes fall back to mock output when absent.

## 2. Image-analysis path

```
capture/page.tsx (CameraCapture)
  → canvas re-encode to WebP @0.92 (strips EXIF), lighting meter in-preview
  → supabase.storage.upload('selfies/{userId}/{uuid}.webp')   [client, RLS]
  → insert skin_photos row                                    [client, RLS]
  → router.push(/analysis/{photo.id})
analysis/[id]/page.tsx
  → look up skin_analyses by photo_id; if none, POST /api/analyze
app/api/analyze/route.ts
  → auth → in-memory rate limit → DB daily cap (5/day)
  → signed URL → fetch image → base64 → Gemini vision (Fitzpatrick-calibrated prompt)
  → parse JSON → insert skin_analyses → mark photo analyzed
```

**Where it's fragile**
- The detail route key is ambiguous: the page treats `[id]` as a **photo_id**, but
  the Timeline links to it with an **analysis_id** (see Issue H1). Viewing history breaks.
- No face/quality gate server-side: any image is sent to Gemini. The camera's
  low-light meter is advisory only and the upload path bypasses it entirely (Issue M1).

## 3. History / progress

- Source of truth: `skin_analyses` (one row per analysis, `health_score`, `concerns[]`,
  `skin_type`, `created_at`), plus `routines`, `routine_feedback`, `routine_step_completions`.
- `dashboard` (server component) aggregates score trend, streaks, adherence, milestones.
- `timeline` (server component) merges analyses/routines/feedback and computes concern trends.
- `compare` does before/after. Storage itself persists correctly — the **defect is
  navigation**: the Timeline's "View details" link can't open a stored analysis (Issue H1).

## 4. Data pipeline

- Reads are mostly **client-side Supabase calls** guarded by RLS (dashboard/timeline are
  server components using the SSR client).
- Writes: photo upload + `skin_photos` insert are client-side; analysis/routine/insights/
  scan writes go through API routes. Account deletion and photo cleanup use the
  service-role client server-side.
- `app/api/setup` is an informational dev helper (anon key, cannot run DDL); real schema
  changes go through `supabase/migrations/*` applied in the Supabase SQL editor / MCP.

## 5. Auth & security

**Good:** RLS on all app tables; private storage bucket + signed URLs; EXIF stripped via
canvas re-encode; service-role key used only in server routes; clear cosmetic-guidance
disclaimers; soft-delete before storage removal in cleanup.

**Gaps** (see issue list): ineffective in-memory rate limiting on serverless; photo
"auto-delete" is manual-only; leaked-password protection disabled; a `SECURITY DEFINER`
RPC is callable by anon; `error_logs` has RLS on but no policies.

## 6. Prioritized issue list (Phase 0 output)

Severity: **H** high · **M** medium · **L** low.

| ID | Sev | Area | Issue | Fix direction |
|----|-----|------|-------|---------------|
| H1 | H | History | `/analysis/[id]` treats the param as `photo_id`, but Timeline "View details" passes an `analysis_id` → past analyses fail to open and can trigger a spurious re-analyze / 404. | Make the detail page resolve by analysis_id (or add `/analysis/by-photo/[photoId]`); align all links. |
| H2 | M‑H | Security/cost | `lib/rate-limit.ts` is a per-process in-memory Map — on Vercel serverless it resets on cold start and doesn't span concurrent instances, so per-minute limits are effectively soft on every API route. | Move to a shared store (Supabase table / Upstash) or DB-backed counters like the analyze daily cap. |
| H3 | M‑H | Privacy | Settings promises photos "auto-delete after N days," but cleanup only runs on a manual button; no schedule. Sensitive face photos persist indefinitely. | Add a scheduled cleanup (cron/Edge Function) enforcing `photo_retention_days`; keep manual as a supplement. |
| M1 | M | Reliability | No server-side face/quality gate; bad/low-light/no-face uploads still produce confident-looking analyses. | Gate in `/api/analyze` (ask the model to report `face_detected`/`image_quality`; reject or warn), surface graceful UI. |
| M2 | M | Auth | Leaked-password protection disabled; no server-side throttling on auth attempts. | Enable HaveIBeenPwned check in Supabase Auth; add basic login throttling. |
| M3 | L‑M | Security | `get_health_score_benchmark()` is `SECURITY DEFINER` executable by `anon`/`authenticated` (advisor WARN). | Confirm intent; switch to `SECURITY INVOKER` or restrict `EXECUTE`. |
| L1 | L | Observability | `error_logs` has RLS enabled but no policies → client error logging silently fails. | Add a scoped insert policy or route logging through a server endpoint. |
| L2 | L | Perf/cosmetic | Unindexed FKs (advisor INFO); `skin_analyses.model_version` DB default still `gemini-2.0-flash`. | Add covering indexes where hot; update default. |

## 7. Feature-gap preview (detail in Phase 1 backlog)

The directive's target features map to current state as: **product recommendations
what/why/where + nearest retail (maps/places)** — _missing_ (routine names ingredients but
no purchase/location layer); **named skin-issue detection with explanations** — _partial_
(concerns are labeled/severity-scored but not tied to a named-condition library or
remediation path); **ingredient-informed remediation from backend research** — _partial_
(deterministic conflict engine exists via the new scanner; no positive "use X for concern Y"
mapping yet). Full competitor matrix + prioritized backlog is Phase 1.

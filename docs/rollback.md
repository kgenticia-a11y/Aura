# Aura Rollback & Error Handling Strategy

## Overview

Aura is designed for graceful degradation. When any external service fails, users see a helpful message and an alternative path forward — never a broken experience.

## Service-Specific Fallbacks

### 1. Gemini API Failure (Skin Analysis)

**Trigger:** `/api/analyze` receives 5xx, timeout, or rate limit from Gemini.

**Response:**
1. Retry 3 times with exponential backoff (1s, 2s, 3s).
2. If all retries fail and the user has prior analyses: serve the most recent cached analysis with a notice: *"AI analysis temporarily unavailable. Showing your most recent results."*
3. If no prior analysis exists: return HTTP 503 with user-friendly error in the UI.

**Code:** `app/api/analyze/route.ts` — see retry loop and fallback query.

### 2. Gemini API Failure (Routine Generation)

**Trigger:** `/api/routine` receives Gemini error.

**Response:**
1. Single retry, then fall back to a category-based default routine using the user's last analysis.
2. Default routine uses the seeded product catalog matched by `category` and `skin_type`.
3. UI shows a banner: *"Standard routine — AI personalization will return shortly."*

### 3. Supabase Database Outage

**Trigger:** Database connection errors or table query failures.

**Response:**
1. Server-rendered pages: show static error UI with `/api/health` link.
2. Client mutations: toast error *"Unable to save right now — please try again."*
3. Health check endpoint at `/api/health` reports `supabase: degraded/down`.

### 4. Supabase Storage Failure (Photo Upload)

**Trigger:** Upload returns error or signed URL generation fails.

**Response:**
1. Client retries upload once.
2. On failure: toast *"Upload failed — check your connection and try again."*
3. The DB record is **not** created until upload succeeds (prevents orphan rows).

### 5. Storage Quota Approaching

**Trigger:** Bucket size at 80%+ of plan limit.

**Response:**
1. Admin alert via `error_logs` table.
2. At 95%: pause new uploads with user-facing message *"Storage temporarily full — please clean up old photos."*
3. Encourage users to delete photos via settings.

### 6. Per-User Rate Limit Hit

**Trigger:** User exceeds 5 analyses/day.

**Response:**
1. HTTP 429 with structured error.
2. UI message: *"Daily analysis limit reached. Try again tomorrow."*
3. Premium tier users have higher limits.

### 7. Authentication / Session Expiration

**Trigger:** `auth.getUser()` returns null on a protected route.

**Response:**
1. `proxy.ts` redirects to `/auth/login`.
2. Failed API requests return HTTP 401.
3. Client receives 401 → triggers full session refresh and re-redirect.

## Rollback Procedure (Deployment)

### Vercel Deployment Rollback
1. Visit Vercel Dashboard → Aura project → Deployments.
2. Select the last known-good deployment.
3. Click "Promote to Production".
4. Verify health: `curl https://aura.app/api/health`.

### Database Migration Rollback
1. Migrations are versioned in `supabase/migrations/`.
2. To roll back a migration, write a reverse migration (don't delete the original).
3. Apply via Supabase Dashboard SQL Editor or MCP `apply_migration`.

### Environment Variable Rollback
1. Vercel project settings → Environment Variables.
2. Restore previous value, redeploy.
3. For Gemini key rotation: update `GEMINI_API_KEY` and redeploy.

## Monitoring

### Health Check
Endpoint: `GET /api/health`
Response:
```json
{
  "status": {
    "app": "healthy",
    "supabase": "healthy",
    "gemini": "configured"
  },
  "overall": "healthy"
}
```

### Error Logging
- All API errors written to `error_logs` table.
- Admin dashboard at `/admin` shows recent errors.
- Critical: monitor for spike in `gemini_api_failure` or `storage_upload_failure`.

### Event Tracking
- User flow events in `app_events`.
- Sudden drop in `analysis_completed` events relative to `photo_captured` → AI degradation.
- Sudden drop in `signup` → auth flow issue.

## Communication Plan

If degradation is sustained > 30 minutes:
1. Add status banner to landing page.
2. Send email to users via Resend (when integrated).
3. Post update on `/status` page (future endpoint).

## Recovery Verification

After any rollback:
1. `npm run build` passes locally.
2. `/api/health` returns 200 with all services healthy.
3. Smoke test: signup → onboarding → capture → analysis → routine.
4. Check `error_logs` table for new errors in last 5 minutes.

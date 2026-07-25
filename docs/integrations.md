# Aura Integration Architecture

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                    Client                        │
│           Next.js 16 (App Router)                │
│    React 19 + Tailwind v4 + shadcn/ui           │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Camera   │  │ Auth     │  │ Dashboard│      │
│  │ Capture  │  │ Pages    │  │ + Routes │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼──────────────┼──────────────┼────────────┘
        │              │              │
        │ TLS 1.3      │ TLS 1.3     │ TLS 1.3
        │              │              │
┌───────┼──────────────┼──────────────┼────────────┐
│       ▼              ▼              ▼            │
│              Next.js Server                      │
│           (API Routes + RSC)                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │/api/     │  │/api/     │  │/api/     │      │
│  │analyze   │  │routine   │  │health    │      │
│  └────┬─────┘  └────┬─────┘  └──────────┘      │
└───────┼──────────────┼───────────────────────────┘
        │              │
   ┌────┼──────────────┼────┐
   │    ▼              ▼    │
   │     Supabase           │
   │  ┌─────────────┐      │
   │  │ Auth (PKCE)  │      │
   │  │ PostgreSQL   │      │
   │  │ Storage      │      │
   │  │ RLS Policies │      │
   │  └─────────────┘      │
   └────────────────────────┘
        │
        │ Signed URL
        ▼
   ┌─────────────┐
   │ Google       │
   │ Gemini API   │
   │ (Vision +    │
   │  Text)       │
   └─────────────┘
```

## Active Integrations

### 1. Supabase
- **Auth**: Email/password with PKCE flow
- **PostgreSQL**: 11 tables with RLS on all
- **Storage**: Private `selfies` bucket, owner-only access
- **Project ID**: `cemifnvrpbcjgmxeruuq`
- **Region**: `us-east-1`
- **Rate Limits**: 500 requests/second (Pro plan)

### 2. Google Gemini API
- **SDK**: `@google/genai`
- **Models Used**:
  - `gemini-2.5-flash` — skin analysis (vision), thinking disabled
  - `gemini-2.5-flash` — routine generation (text), thinking disabled
- **API Key**: Server-side only (`GEMINI_API_KEY`)
- **Rate Limits**: 1,500 RPM on free tier, 360 RPD for vision
- **Fallback**: Cached last analysis + "temporarily unavailable" message

## Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Supabase anonymous key |
| `GEMINI_API_KEY` | `.env.local` | Google Gemini API key (server-only) |

## Future Integration Points (Documented, Not Built)

### Stripe (Payment Processing)
- Subscription billing for Basic/Premium/VIP tiers
- Stripe Checkout for signup flow
- Webhooks for subscription lifecycle
- `@stripe/stripe-js` + `stripe` SDK

### Resend (Transactional Email)
- "Analysis Ready" notifications
- Weekly skin journey summaries
- Password reset emails
- `resend` SDK (already used in grantforge)

### Web Push Notifications
- Weekly analysis reminders
- Routine feedback prompts
- Product recommendation alerts
- Browser Push API + service worker

### Product Affiliate Links
- Embed affiliate URLs in product recommendations
- Track clicks via app_events
- Revenue share with skincare brands

## API Key Rotation Schedule

| Key | Rotation | Method |
|-----|----------|--------|
| Supabase anon key | On compromise | Supabase Dashboard → Settings → API |
| Gemini API key | Quarterly | Google Cloud Console → Credentials |
| Supabase DB password | On compromise | Supabase Dashboard → Settings → Database |

## Fallback Behavior

| Service | Failure Mode | Fallback |
|---------|-------------|----------|
| Gemini API | 503 / timeout | Retry 3x with backoff → serve cached analysis |
| Supabase DB | Connection error | Static error page |
| Supabase Storage | Upload failure | Retry → user error message |
| Supabase Auth | Session expired | Redirect to login |

# Aura Security Architecture

## Overview

Aura handles sensitive user data (selfie photos, skin analysis results, personal profiles). Security is built into every layer using a defense-in-depth approach.

## Data Flow Encryption

```
Client (Browser)
  │ HTTPS/TLS 1.3
  ▼
Next.js Server (Vercel Edge)
  │ HTTPS/TLS 1.3
  ▼
Supabase (PostgreSQL + Storage)
  └─ AES-256 encryption at rest

Client → Gemini Vision API
  │ HTTPS/TLS 1.3 (server-side only)
  └─ API key never exposed to client
```

### In Transit
- All client ↔ server communication over HTTPS with TLS 1.3
- Supabase enforces TLS on all connections
- Gemini API calls made server-side only, never from the browser

### At Rest
- Supabase Storage: AES-256 encryption (platform default)
- Supabase PostgreSQL: encrypted volumes
- No sensitive data stored in browser localStorage/cookies (only session tokens)

## Authentication & Authorization

### Auth Flow (PKCE)
1. User signs up/in via email+password
2. Supabase Auth issues JWT tokens
3. Tokens stored as HttpOnly cookies (not accessible via JavaScript)
4. `proxy.ts` refreshes sessions on every request
5. Protected routes redirect unauthenticated users to `/auth/login`

### Row-Level Security (RLS)
Every table has RLS enabled with owner-only policies:
- `profiles`: `auth.uid() = id`
- `skin_profiles`: `auth.uid() = user_id`
- `skin_photos`: `auth.uid() = user_id`
- `skin_analyses`: `auth.uid() = user_id`
- `routines`: `auth.uid() = user_id`
- `routine_feedback`: `auth.uid() = user_id`
- `products`: publicly readable (catalog data)

### Storage Security
- `selfies` bucket: private, owner-only access
- Storage path scoped: `{user_id}/{file_id}.webp`
- RLS on `storage.objects`: folder name must match `auth.uid()`
- Signed URLs with 1-hour expiry for AI processing
- No raw URLs ever exposed to client

## API Security

### Server-Side Protections
- All API routes verify Supabase JWT before processing
- Gemini API key stored as server-side environment variable only
- Request validation with Zod schemas on all inputs
- Rate limiting: 5 analyses per user per day

### Content Security
- EXIF metadata stripped from photos before storage (prevents GPS leakage)
- Canvas re-rendering removes all embedded metadata
- Photos stored as WebP (lossy re-encode, no metadata preserved)

## Privacy by Design

1. **Data Minimization**: Only collect what's needed for the service
2. **Purpose Limitation**: Photos used only for skin analysis, then auto-purged
3. **User Control**: Download data, delete account, adjust retention
4. **Consent Audit Trail**: `privacy_accepted_at` timestamp in profiles
5. **No Third-Party Analytics**: All tracking is first-party in Supabase
6. **Auto-Purge**: Photos deleted 30 days after analysis

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Unauthorized data access | RLS on all tables, JWT auth verification |
| Photo interception | TLS in transit, AES-256 at rest |
| EXIF data leakage | Client-side metadata stripping via canvas |
| API key exposure | Server-side only, never in client bundles |
| Brute force auth | Supabase rate limiting on auth endpoints |
| XSS | React's built-in escaping, no `dangerouslySetInnerHTML` |
| CSRF | SameSite cookies, origin validation |
| Excessive API usage | Per-user daily rate limits |

## Incident Response

1. **Detection**: Error logs + health check endpoint monitoring
2. **Containment**: Disable affected API routes via environment flags
3. **Investigation**: Review error_logs table, Supabase audit logs
4. **Remediation**: Patch, rotate affected keys, notify users if needed
5. **Post-mortem**: Document and improve

## Key Rotation

| Key | Rotation Strategy |
|-----|-------------------|
| Supabase anon key | Rotate via Supabase dashboard, update `.env.local` |
| Gemini API key | Rotate via Google Cloud console, update `.env.local` |
| Supabase DB password | Rotate via Supabase dashboard |

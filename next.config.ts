import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Resolve the Supabase origin so the CSP can allowlist exactly it for
// connect-src (the real data-exfiltration channel for XSS) instead of a blanket
// `https:`. Falls back to permissive only if the env var is absent at build time,
// so a missing value can never produce a malformed header that breaks the app.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseOrigin = "";
try {
  supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
} catch {
  supabaseOrigin = "";
}
const supabaseHost = supabaseOrigin ? new URL(supabaseOrigin).host : "";
const connectSrc = supabaseOrigin
  ? `connect-src 'self' ${supabaseOrigin} wss://${supabaseHost}`
  : "connect-src 'self' https: wss:";

// Content-Security-Policy for an app that handles auth sessions and sensitive
// face photos. Honest scope of what this buys us:
//   - frame-ancestors 'none' / object-src 'none' / base-uri 'self': fully block
//     clickjacking, plugin embedding, and <base> hijacking.
//   - connect-src: locked to self + the Supabase origin, so injected script can't
//     POST stolen data to an arbitrary endpoint.
//   - script-src still needs 'unsafe-inline' because Next.js injects inline
//     bootstrap scripts without a nonce in this setup, so this CSP is NOT a
//     complete XSS defense on its own — output escaping remains the primary
//     control. 'unsafe-eval' is dev-only (Turbopack HMR needs it); production
//     drops it since the App Router runtime does not require eval.
//   - img-src stays broad (https:, data:, blob:) for camera-capture previews,
//     Supabase signed URLs, and future external product imagery; images are a
//     GET-only, low-value exfil channel, so this is a deliberate trade-off.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  connectSrc,
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Only meaningful over HTTPS; skipped in dev where the server is http://localhost.
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Legacy fallback for pre-CSP browsers; frame-ancestors 'none' above supersedes
  // it in modern ones. Kept intentionally per OWASP's belt-and-suspenders guidance.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  },
];

// Transport hardening only makes sense over HTTPS. Emitting HSTS on
// http://localhost during `next dev` would poison the browser's HSTS cache for
// the whole host, so it is production-only. max-age without includeSubDomains/
// preload: the app currently runs on a shared *.vercel.app subdomain it does not
// own subdomains of, and cannot submit to the preload list — those flags would be
// misleading. Revisit when moving to a custom apex domain.
if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000",
  });
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

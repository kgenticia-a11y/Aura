import type { NextConfig } from "next";

// Baseline security headers applied to every response. These are defense-in-depth
// guardrails that matter for an app handling authenticated sessions and sensitive
// face photos:
//   - frame-ancestors / X-Frame-Options: block clickjacking (no embedding in iframes).
//   - X-Content-Type-Options: stop MIME sniffing (matters for the SVG report-card route).
//   - Referrer-Policy: don't leak URLs (which carry analysis IDs) to third parties.
//   - Permissions-Policy: only this origin may use the camera (capture) and geolocation
//     (nearest-retail lookup); everything else is denied.
//   - HSTS: force HTTPS once seen (Vercel already serves HTTPS; this hardens it).
// The CSP is intentionally pragmatic: it locks down framing, plugins, and base-uri
// (real, low-risk wins) while staying permissive enough for Next.js/Turbopack inline
// bootstrap, Tailwind inline styles, blob/data image previews, and Supabase over
// https/wss — so it hardens without breaking the app.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

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

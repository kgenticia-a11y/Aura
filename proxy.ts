import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Forward the current pathname to Server Components — the protected layout
  // reads `x-next-pathname` to detect the onboarding page and skip its
  // onboarding-completed redirect (without it, a not-yet-onboarded user on
  // /onboarding is redirected to /onboarding in an infinite loop).
  //
  // `request.headers` is read-only, so per the Next.js docs we clone it into a
  // new Headers object and forward the clone upstream. Mutating request.headers
  // in place is not a supported pattern and does not reliably propagate.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-next-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild the response, preserving the forwarded pathname header.
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session if it exists. Keep this immediately after client
  // creation with no intervening logic (Supabase SSR requirement).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes.
  const protectedPrefixes = [
    "/dashboard", "/capture", "/analysis", "/routine",
    "/onboarding", "/timeline", "/settings", "/compare",
    "/products", "/feedback", "/admin", "/scan", "/derm",
  ];
  const isProtectedRoute = protectedPrefixes.some((p) =>
    pathname.startsWith(p)
  );

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return withRefreshedCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // Redirect authenticated users away from auth pages.
  const isAuthRoute =
    pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup");

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return withRefreshedCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}

// Carry any refreshed-session cookies from the tracked response onto a redirect
// response, so a token rotation performed by getUser() isn't dropped when we
// return a different response object.
function withRefreshedCookies(
  from: NextResponse,
  to: NextResponse
): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

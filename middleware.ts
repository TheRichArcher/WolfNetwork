import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";

const geofenceEnabled = process.env.LA_GEOFENCE_ENABLED === "true";
const laCity = process.env.LA_GEOFENCE_CITY || "Los Angeles";

export default withAuth(async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  // Read at runtime; allow in production when explicitly enabled
  const authBypass = process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "true";

  // Debug: log session status on root hits to verify middleware and auth state
  if (nextUrl.pathname === "/") {
    try {
      const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      console.log("middleware match /", { path: nextUrl.pathname });
      if (session) {
        console.log("middleware session / present");
      } else {
        console.log("middleware session / null");
      }
    } catch (e) {
      console.log("middleware session error /", (e as Error)?.message);
    }
  }

  const isAuthRoute =
    nextUrl.pathname === "/" ||
    nextUrl.pathname.startsWith("/api/auth") ||
    // Allow Twilio to reach our TwiML + call endpoints without auth & geofence
    nextUrl.pathname.startsWith("/api/hotline/") ||
    // Legacy activate-hotline route should be allowed (compat)
    nextUrl.pathname === "/api/activate-hotline" ||
    // Public signup routes (UI + APIs)
    nextUrl.pathname === "/signup" ||
    nextUrl.pathname.startsWith("/api/signup/") ||
    nextUrl.pathname.startsWith("/api/twilio/") ||
    nextUrl.pathname === "/blocked" ||
    nextUrl.pathname === "/biometric" ||
    nextUrl.pathname.startsWith("/_next");
  if (isAuthRoute) return NextResponse.next();

  // In development, optionally bypass auth for select endpoints/pages to unblock testing
  if (authBypass) {
    const devBypassPaths = [
      "/api/me",
      "/api/me/security-status",
      "/api/me/last-incident",
      "/api/me/team",
      "/api/me/active-session",
      "/api/partners/presence",
      "/",
      "/hotline",
      "/profile",
    ];
    if (devBypassPaths.some((p) => nextUrl.pathname === p)) {
      return NextResponse.next();
    }
  }

  // Reliable auth check using NextAuth JWT
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = Boolean(token);
  if (!isLoggedIn) {
    if (nextUrl.pathname === "/") {
      console.log("redirecting to /signup");
    }
    const signupUrl = new URL("/signup", nextUrl);
    signupUrl.searchParams.set("next", nextUrl.href);
    return NextResponse.redirect(signupUrl, 302);
  }

  const biometricOk = req.cookies.get("biometric_ok")?.value === "1";
  if (!biometricOk) {
    const bioUrl = new URL("/biometric", nextUrl);
    bioUrl.searchParams.set("next", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(bioUrl);
  }

  if (geofenceEnabled) {
    const cityHeader = req.headers.get("x-vercel-ip-city") || "";
    // Vercel Edge adds geo property at runtime; access via type assertion
    const geo = (req as NextRequest & { geo?: { city?: string } }).geo;
    const city = geo?.city || cityHeader;
    if (city && city !== laCity) {
      const blockedUrl = new URL("/blocked", nextUrl);
      blockedUrl.searchParams.set("reason", "geo");
      return NextResponse.redirect(blockedUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Protect all routes (including '/') while excluding NextAuth and static assets
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|wolf.svg|wolf-vector.png).*)",
  ],
};



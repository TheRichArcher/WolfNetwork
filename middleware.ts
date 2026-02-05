import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";

const geofenceEnabled = process.env.LA_GEOFENCE_ENABLED === "true";
const laCity = process.env.LA_GEOFENCE_CITY || "Los Angeles";

// Public routes that don't require authentication
const publicRoutes = [
  "/",
  "/signup",
  "/blocked",
  "/biometric",
];

const isPublicRoute = (pathname: string) =>
  publicRoutes.includes(pathname) ||
  pathname.startsWith("/api/auth") ||
  pathname.startsWith("/api/hotline/") ||
  pathname === "/api/activate-hotline" ||
  pathname.startsWith("/api/signup/") ||
  pathname.startsWith("/api/twilio/") ||
  pathname.startsWith("/_next");

export default withAuth(async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  // Read at runtime; allow in production when explicitly enabled
  const authBypass = process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "true";

  // Public routes - allow through without auth
  if (isPublicRoute(nextUrl.pathname)) return NextResponse.next();

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
}, {
  callbacks: {
    // Return true to allow request through to middleware function
    // Return false to redirect to signIn page
    authorized: ({ req, token }) => {
      const pathname = req.nextUrl.pathname;
      // Public routes: always allow through
      if (isPublicRoute(pathname)) return true;
      // Protected routes: require token
      return !!token;
    },
  },
  pages: {
    signIn: "/signup",
  },
});

export const config = {
  matcher: [
    // Protect all routes (including '/') while excluding NextAuth and static assets
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|wolf.svg|wolf-vector.png).*)",
  ],
};



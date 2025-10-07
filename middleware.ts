import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

const geofenceEnabled = process.env.LA_GEOFENCE_ENABLED === "true";
const laCity = process.env.LA_GEOFENCE_CITY || "Los Angeles";

export default withAuth(function middleware(req: NextRequest) {
  const { nextUrl } = req;

  const isAuthRoute =
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname === "/blocked" ||
    nextUrl.pathname === "/biometric" ||
    nextUrl.pathname.startsWith("/_next");
  if (isAuthRoute) return NextResponse.next();

  const isLoggedIn = !!(req as any).nextauth?.token;
  if (!isLoggedIn) {
    const signInUrl = new URL("/api/auth/signin", nextUrl);
    signInUrl.searchParams.set("callbackUrl", nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  const biometricOk = req.cookies.get("biometric_ok")?.value === "1";
  if (!biometricOk) {
    const bioUrl = new URL("/biometric", nextUrl);
    bioUrl.searchParams.set("next", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(bioUrl);
  }

  if (geofenceEnabled) {
    const cityHeader = req.headers.get("x-vercel-ip-city") || "";
    const city = (req as any).geo?.city || cityHeader;
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
    // Exclude the root path by requiring at least one character after '/'
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|wolf.svg|wolf-logo.png).+)",
  ],
};



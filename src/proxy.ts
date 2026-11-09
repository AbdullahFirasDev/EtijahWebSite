import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: staff pages without a session cookie go straight to the login page.
// The real session and permission checks run on the server in every staff page and action.
export function proxy(request: NextRequest) {
  // nextUrl.pathname excludes the optional basePath, and NextURL re-adds it on redirect.
  if (request.nextUrl.pathname.startsWith("/staff/login")) return NextResponse.next();
  if (!request.cookies.has("etijah_staff")) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/staff", "/staff/:path*"],
};

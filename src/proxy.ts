import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: portal pages without a session cookie go straight to their login page.
// The real session, company and permission checks run on the server in every page and action.
export function proxy(request: NextRequest) {
  // nextUrl.pathname excludes the optional basePath, and NextURL re-adds it on redirect.
  const path = request.nextUrl.pathname;
  const b2b = path === "/b2b" || path.startsWith("/b2b/");
  if (path.startsWith("/staff/login") || path.startsWith("/b2b/login")) return NextResponse.next();
  if (!request.cookies.has(b2b ? "etijah_b2b" : "etijah_staff")) {
    const url = request.nextUrl.clone();
    url.pathname = b2b ? "/b2b/login/" : "/staff/login/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/staff", "/staff/:path*", "/b2b", "/b2b/:path*"],
};

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = request.nextUrl;

  // Cho phép truy cập trang login và API auth
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    // Nếu đã đăng nhập, redirect về trang chủ
    if (token && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Nếu chưa đăng nhập, redirect về login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Bảo vệ tất cả route TRỪ:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, public files
     * - API routes (trừ auth routes đã handle ở trên)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/data|api/alert).*)",
  ],
};

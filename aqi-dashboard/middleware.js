import { NextResponse } from "next/server";

// Middleware không chặn gì cả — Dashboard là public
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};

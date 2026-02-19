import { auth } from "@/auth";

const publicRoutes = ["/auth/login", "/auth/register", "/auth/forgot-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // Let auth API routes return JSON (session, signin, etc.); do not redirect them to login
  if (pathname.startsWith("/api/auth")) return;
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
  if (isPublic) return;
  if (!req.auth) {
    const login = new URL("/auth/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return Response.redirect(login);
  }
});

export const config = {
  // Exclude /api/auth so session and other auth API calls return JSON, not redirects
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

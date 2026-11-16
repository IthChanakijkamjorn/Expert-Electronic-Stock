import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const IDLE_MS = 60 * 60 * 1000;
const ACTIVE = "last_active";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ?? null;

  if (user) {
    const last = Number(request.cookies.get(ACTIVE)?.value);
    if (last && Date.now() - last > IDLE_MS) {
      const out = NextResponse.redirect(new URL("/login", request.url));
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith("sb-") || name === ACTIVE) out.cookies.delete(name);
      });
      return out;
    }
  }

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isShare = request.nextUrl.pathname.startsWith("/s/");
  if (isShare) return response;
  if (user) {
    response.cookies.set(ACTIVE, String(Date.now()), { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  }
  if (!user && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // A password-only session must still be able to reach the code prompt.
  if (user && isLogin && !request.nextUrl.pathname.startsWith("/login/mfa")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};

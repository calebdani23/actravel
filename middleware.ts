import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_LOGIN_PATH = "/admin/login";

export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminLoginPath(pathname: string) {
  return pathname === ADMIN_LOGIN_PATH;
}

export function isProtectedAdminPath(pathname: string) {
  return isAdminPath(pathname) && !isAdminLoginPath(pathname);
}

function redirectTo(request: NextRequest, pathname: string, cookiesToSet: CookieToSet[]) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const response = NextResponse.redirect(url);
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isAdminPath(pathname)) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  let cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies) {
        cookiesToSet = nextCookies;
        nextCookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        nextCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  const hasUser = Boolean(data.user && !error);

  if (!hasUser && isProtectedAdminPath(pathname)) {
    return redirectTo(request, ADMIN_LOGIN_PATH, cookiesToSet);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};

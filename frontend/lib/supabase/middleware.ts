import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Cookie interface for type safety
interface CookieItem {
  name: string
  value: string
  options?: Record<string, unknown>
}

// Filter out problematic cookies in development
function filterCookies(cookies: CookieItem[]) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) {
    return cookies;
  }
  
  // Filter out Cloudflare and other problematic cookies in development
  const excludedCookies = ['__cf_bm', '__cflb', '__cfruid', '_cfuvid'];
  
  return cookies.filter(cookie => {
    const shouldExclude = excludedCookies.some(excluded => 
      cookie.name.startsWith(excluded)
    );
    
    if (shouldExclude) {
      console.log(`[Middleware] Filtering out cookie: ${cookie.name}`);
    }
    
    return !shouldExclude;
  });
}

// Safe cookie options for local development
function getSafeCookieOptions(options: Record<string, unknown> = {}) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    return {
      ...options,
      domain: undefined, // Remove domain in development
      secure: false,     // Allow non-HTTPS in development
      sameSite: 'lax'    // More permissive in development
    };
  }
  
  return options;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const allCookies = request.cookies.getAll();
          return filterCookies(allCookies);
        },
        setAll(cookiesToSet) {
          const filteredCookies = filterCookies(cookiesToSet);
          
          filteredCookies.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          
          supabaseResponse = NextResponse.next({
            request,
          });
          
          filteredCookies.forEach(({ name, value, options }) => {
            const safeOptions = getSafeCookieOptions(options);
            supabaseResponse.cookies.set(name, value, safeOptions);
          });
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!
  return { supabaseResponse, user };
}
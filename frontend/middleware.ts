import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Skip middleware for static files, API routes, and assets
  if (
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/.well-known/') ||
    request.nextUrl.pathname === '/site.webmanifest' ||
    request.nextUrl.pathname === '/manifest.json' ||
    request.nextUrl.pathname === '/robots.txt' ||
    request.nextUrl.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value)
            })
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              // Filter out invalid cookies for localhost development
              if (process.env.NODE_ENV === 'development') {
                // Skip Cloudflare cookies in development
                if (name.startsWith('__cf_') || name.startsWith('__cflb')) {
                  return
                }
              }
              supabaseResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Get current session
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // Define public routes (root '/' now requires authentication)
    const publicRoutes = [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
    ]

    const isPublicRoute = publicRoutes.some(route => 
      request.nextUrl.pathname === route || 
      request.nextUrl.pathname.startsWith(route + '/')
    )

    // If there's an auth error or no user, handle authentication
    if (error || !user) {
      // If accessing a protected route, redirect to login
      if (!isPublicRoute) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
        return NextResponse.redirect(loginUrl)
      }
      // Allow access to public routes
      return supabaseResponse
    }

    // User is authenticated
    // If accessing auth pages while logged in, redirect to dashboard
    if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If authenticated user accesses root, redirect to dashboard
    if (user && request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Add user info to response headers for client-side access
    supabaseResponse.headers.set('x-user-authenticated', 'true')
    if (user?.id) {
      supabaseResponse.headers.set('x-user-id', user.id)
    }

    return supabaseResponse

  } catch (error) {
    console.error('Middleware error:', error)
    
    // On error, allow public routes but redirect protected routes to login
    const publicRoutes = [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
    ]

    const isPublicRoute = publicRoutes.some(route => 
      request.nextUrl.pathname === route || 
      request.nextUrl.pathname.startsWith(route + '/')
    )

    if (!isPublicRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }

    return supabaseResponse
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Type definitions
interface ExternalUser {
  id?: string;
  user_id?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  };
}

interface SupabaseClient {
  auth: {
    admin: {
      listUsers: () => Promise<{ 
        data: { users: Array<{ id: string; email: string }> }; 
        error: Error | null 
      }>;
      createUser: (userData: {
        email: string;
        email_confirm: boolean;
        user_metadata: Record<string, unknown>;
      }) => Promise<{ 
        data: { user: { id: string; email: string } }; 
        error: Error | null 
      }>;
      generateLink: (linkData: {
        type: string;
        email: string;
        options: { redirectTo: string };
      }) => Promise<{ 
        data: { properties?: { action_link?: string } }; 
        error: Error | null 
      }>;
    };
  };
}

// Function to verify access token with external auth service
async function verifyAccessToken(accessToken: string) {
  try {
    const response = await fetch('https://makebell-supabase.onrender.com/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        access_token: accessToken
      })
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json();
    return { valid: data.valid || true, user: data.user || data };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { valid: false };
  }
}

// Function to refresh tokens with external auth service
async function refreshTokens(refreshToken: string) {
  try {
    const response = await fetch('https://makebell-supabase.onrender.com/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    return {
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    return { success: false };
  }
}

// Function to check if user exists in Supabase and create if needed
async function handleSupabaseUser(supabase: SupabaseClient, externalUser: ExternalUser, hasSupabaseSession: boolean, request?: NextRequest) {
  try {
    const email = externalUser.email || externalUser.user?.email;
    const userId = externalUser.id || externalUser.user?.id || externalUser.user_id;
    
    if (!email) {
      console.error('[Middleware] No email found in external user data');
      return { success: false, error: 'No email found' };
    }

    console.log(`[Middleware] Checking for user with email: ${email}`);

    // Check if user exists in Supabase auth
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('[Middleware] Error listing users:', listError);
      return { success: false, error: listError.message };
    }

    const existingUser = existingUsers.users.find((user: { id: string; email: string }) => user.email === email);

    if (existingUser) {
      console.log(`[Middleware] User exists in Supabase: ${existingUser.id}`);
      
      // ✅ FIXED: Generate magic link if user exists but has no active session
      if (!hasSupabaseSession) {
        console.log(`[Middleware] User exists but no active session, generating magic link`);
        
        // Generate magic link for existing user to establish session
        const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: {
            redirectTo: getBaseUrl(request)
          }
        });

        if (magicLinkError) {
          console.error('[Middleware] Error generating magic link for existing user:', magicLinkError);
          return { success: false, error: magicLinkError.message };
        }

        return { 
          success: true, 
          user: existingUser, 
          magicLink: magicLinkData.properties?.action_link,
          isNewUser: false 
        };
      } else {
        // User has active session, no magic link needed
        return { 
          success: true, 
          user: existingUser, 
          magicLink: null,
          isNewUser: false 
        };
      }
    } else {
      console.log(`[Middleware] Creating new user in Supabase for email: ${email}`);
      
      // Create new user in Supabase
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true, // Mark email as verified
        user_metadata: {
          external_user_id: userId,
          external_auth: true,
          name: externalUser.name || externalUser.user?.name,
          avatar_url: externalUser.avatar_url || externalUser.user?.avatar_url
        }
      });

      if (createError) {
        console.error('[Middleware] Error creating user:', createError);
        return { success: false, error: createError.message };
      }

      console.log(`[Middleware] Successfully created user: ${newUser.user.id}`);

      // Generate magic link for new user
      const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: getBaseUrl(request)
        }
      });

      if (magicLinkError) {
        console.error('[Middleware] Error generating magic link for new user:', magicLinkError);
        return { success: false, error: magicLinkError.message };
      }

      return { 
        success: true, 
        user: newUser.user, 
        magicLink: magicLinkData.properties?.action_link,
        isNewUser: true 
      };
    }
  } catch (error) {
    console.error('[Middleware] Error in handleSupabaseUser:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Get the appropriate base URL based on environment
function getBaseUrl(request?: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // HARDCODED: If we detect Render environment, always use the known public URL
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
    return 'https://tabular-frontend.onrender.com';
  }
  
  // For production, ALWAYS use the public URL first
  if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('0.0.0.0')) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // Try to extract from request headers if available
  if (request) {
    // Check X-Forwarded-Host first (Render sets this to the public domain)
    const forwardedHost = request.headers.get('x-forwarded-host');
    if (forwardedHost && !forwardedHost.includes('0.0.0.0') && !forwardedHost.includes('localhost')) {
      console.log(`[getBaseUrl] Using x-forwarded-host: ${forwardedHost}`);
      return `https://${forwardedHost}`;
    }
    
    // Check regular host header
    const host = request.headers.get('host');
    if (host && !host.includes('0.0.0.0') && !host.includes('localhost') && !host.includes('10000')) {
      console.log(`[getBaseUrl] Using host header: ${host}`);
      return `https://${host}`;
    }
  }
  
  // Fallback: your known production URL (NEVER use 0.0.0.0)
  console.log(`[getBaseUrl] Using fallback URL`);
  return 'https://tabular-frontend.onrender.com';
}

export async function middleware(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;
  
  // Generate unique request ID for traceability
  const requestId = Math.random().toString(36).substring(2, 8);
  
  // Debug logging
  console.log(`[Middleware:${requestId}] Processing request for: ${pathname}`);
  console.log(`[Middleware:${requestId}] Request URL: ${request.url}`);

  // Path guard - skip auth confirm routes completely
  if (pathname.startsWith('/auth/confirm')) {
    console.log(`[Middleware:${requestId}] Skipping auth/confirm route`);
    return NextResponse.next();
  }

  // Skip middleware for static files, API routes, auth routes, and assets
  if (
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/auth/') ||  // Skip all auth routes
    request.nextUrl.pathname.startsWith('/.well-known/') ||
    request.nextUrl.pathname === '/site.webmanifest' ||
    request.nextUrl.pathname === '/manifest.json' ||
    request.nextUrl.pathname === '/robots.txt' ||
    request.nextUrl.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // Check for tokens in query parameters first (from auth redirect)
  const accessTokenFromQuery = searchParams.get('access_token');
  const refreshTokenFromQuery = searchParams.get('refresh_token');
  
  // If tokens are in query params, store them in cookies and redirect to clean URL
  if (accessTokenFromQuery && refreshTokenFromQuery) {
    console.log(`[Middleware:${requestId}] Found tokens in query params, storing in cookies`);
    
    const baseUrl = getBaseUrl(request);
    console.log(`[Middleware:${requestId}] Base URL resolved to: ${baseUrl}`);
    console.log(`[Middleware:${requestId}] Request headers - host: ${request.headers.get('host')}, x-forwarded-host: ${request.headers.get('x-forwarded-host')}`);
    
    const response = NextResponse.redirect(new URL(pathname, baseUrl));
    
    // Set cookies with the tokens
    response.cookies.set('access_token', accessTokenFromQuery, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    response.cookies.set('refresh_token', refreshTokenFromQuery, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    
    return response;
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    // Check if service role key is available for admin operations
    const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      console.log(`[Middleware:${requestId}] Warning: SUPABASE_SERVICE_ROLE_KEY not available. Admin operations will be skipped.`);
    }
    
    // Initialize Supabase client with service role for admin operations (if available)
    const supabase = serviceRoleKey ? createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
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
    ) as unknown as SupabaseClient : null;

    // Also create regular client for user operations
    const supabaseUserClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // No-op for user client in middleware
          },
        },
      }
    )

    // Get current session from Supabase
    const {
      data: { user: supabaseUser },
      error: supabaseError,
    } = await supabaseUserClient.auth.getUser()

    // Get tokens from cookies for external auth service
    const accessToken = request.cookies.get('access_token')?.value;
    const refreshToken = request.cookies.get('refresh_token')?.value;
    
    console.log(`[Middleware:${requestId}] Access token exists: ${!!accessToken}, Refresh token exists: ${!!refreshToken}`);
    console.log(`[Middleware:${requestId}] Supabase user exists: ${!!supabaseUser}, Supabase error: ${!!supabaseError}`);

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

    // Check external auth service first
    let externalAuthValid = false;
    let externalUser = null;

    if (accessToken) {
      console.log(`[Middleware:${requestId}] Verifying access token with external service`);
      const verification = await verifyAccessToken(accessToken);
      
      if (verification.valid) {
        console.log(`[Middleware:${requestId}] External access token valid`);
        externalAuthValid = true;
        externalUser = verification.user;

        // ✅ FIXED: Pass hasSupabaseSession to handleSupabaseUser
        // Only handle Supabase user creation/login if we have service role key
        if (externalUser && (externalUser.email || externalUser.user?.email) && supabase) {
          console.log(`[Middleware:${requestId}] Handling Supabase user (has session: ${!!supabaseUser})`);
          const supabaseUserResult = await handleSupabaseUser(supabase, externalUser, !!supabaseUser, request);
          
          if (supabaseUserResult.success && supabaseUserResult.magicLink) {
            console.log(`[Middleware:${requestId}] Supabase user handled successfully, redirecting to magic link`);
            
            // Extract the verification token from the magic link
            const magicLinkUrl = new URL(supabaseUserResult.magicLink);
            const token = magicLinkUrl.searchParams.get('token');
            const type = magicLinkUrl.searchParams.get('type');
            
            if (token && type) {
              const origin = getBaseUrl(request);
              const verifyUrl = new URL('/auth/confirm', origin);
              verifyUrl.searchParams.set('token', token);
              verifyUrl.searchParams.set('type', type);
              
              // Set next to dashboard or the original intended destination
              const nextPage = request.nextUrl.pathname === '/' ? '/dashboard' : 
                              request.nextUrl.pathname.startsWith('/auth') ? '/dashboard' : 
                              request.nextUrl.pathname;
              verifyUrl.searchParams.set('next', nextPage);
              
              console.log(`[Middleware:${requestId}] Redirecting to magic link verification: ${verifyUrl.toString()}`);
              return NextResponse.redirect(verifyUrl);
            }
          } else if (supabaseUserResult.success && !supabaseUserResult.magicLink) {
            console.log(`[Middleware:${requestId}] User has active Supabase session, no magic link needed`);
          } else if (!supabaseUserResult.success) {
            console.error(`[Middleware:${requestId}] Failed to handle Supabase user:`, supabaseUserResult.error);
          }
        }
      } else {
        console.log(`[Middleware:${requestId}] External access token invalid, attempting refresh`);
        
        // Try to refresh with refresh token
        if (refreshToken) {
          const refreshResult = await refreshTokens(refreshToken);
          
          if (refreshResult.success && refreshResult.access_token && refreshResult.refresh_token) {
            console.log(`[Middleware:${requestId}] Token refresh successful`);
            
            // Update cookies with new tokens
            supabaseResponse.cookies.set('access_token', refreshResult.access_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7 // 7 days
            });
            
            supabaseResponse.cookies.set('refresh_token', refreshResult.refresh_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 30 // 30 days
            });
            
            // Verify the new token and handle Supabase user
            const newVerification = await verifyAccessToken(refreshResult.access_token);
            if (newVerification.valid) {
              externalAuthValid = true;
              externalUser = newVerification.user;
              
              // ✅ FIXED: Pass hasSupabaseSession to handleSupabaseUser after refresh
              if (externalUser && (externalUser.email || externalUser.user?.email) && supabase) {
                console.log(`[Middleware:${requestId}] Handling Supabase user after refresh (has session: ${!!supabaseUser})`);
                const supabaseUserResult = await handleSupabaseUser(supabase, externalUser, !!supabaseUser, request);
                
                if (supabaseUserResult.success && supabaseUserResult.magicLink) {
                  console.log(`[Middleware:${requestId}] Supabase user handled after refresh, redirecting to magic link`);
                  
                  const magicLinkUrl = new URL(supabaseUserResult.magicLink);
                  const token = magicLinkUrl.searchParams.get('token');
                  const type = magicLinkUrl.searchParams.get('type');
                  
                  if (token && type) {
                    const origin = getBaseUrl(request);
                    const verifyUrl = new URL('/auth/confirm', origin);
                    verifyUrl.searchParams.set('token', token);
                    verifyUrl.searchParams.set('type', type);
                    
                    // Set next to dashboard or the original intended destination  
                    const nextPage = request.nextUrl.pathname === '/' ? '/dashboard' : 
                                    request.nextUrl.pathname.startsWith('/auth') ? '/dashboard' : 
                                    request.nextUrl.pathname;
                    verifyUrl.searchParams.set('next', nextPage);
                    
                    return NextResponse.redirect(verifyUrl);
                  }
                } else if (supabaseUserResult.success && !supabaseUserResult.magicLink) {
                  console.log(`[Middleware:${requestId}] User has active Supabase session after refresh, no magic link needed`);
                }
              }
            }
          }
        }
      }
    }

    // If no external auth tokens found, redirect to external auth service
    if (!accessToken && !refreshToken) {
      console.log(`[Middleware:${requestId}] No external auth tokens found, redirecting to auth service`);
      
      if (!isPublicRoute) {
        const currentUrl = getBaseUrl(request);
        const loginUrl = `https://makebell-supabase.onrender.com/auth/login?redirect_url=${encodeURIComponent(currentUrl)}&app_name=Meeting%20Minutes%20AI`;
        
        console.log(`[Middleware:${requestId}] Redirecting to external auth: ${loginUrl}`);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Check if either Supabase auth or external auth is valid
    const isAuthenticated = (supabaseUser && !supabaseError) || externalAuthValid;
    
    console.log(`[Middleware:${requestId}] Final auth status - Supabase: ${!!supabaseUser}, External: ${externalAuthValid}, Overall: ${isAuthenticated}`);

    // If there's no authentication from either service, handle accordingly
    if (!isAuthenticated) {
      // If accessing a protected route, redirect to login
      if (!isPublicRoute) {
        // Prefer external auth service if no tokens, otherwise use Supabase login
        if (!accessToken && !refreshToken) {
          const currentUrl = request.url;
          const loginUrl = `https://makebell-supabase.onrender.com/auth/login?redirect_url=${encodeURIComponent(getBaseUrl(request))}&app_name=Meeting%20Minutes%20AI`;
          
          // Clear any invalid cookies
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete('access_token');
          response.cookies.delete('refresh_token');
          return response;
        } else {
          // Use Supabase login as fallback
          const origin = getBaseUrl(request);
          const loginUrl = new URL('/login', origin);
          loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search);
          return NextResponse.redirect(loginUrl);
        }
      }
      // Allow access to public routes
      return supabaseResponse;
    }

    // User is authenticated (either through Supabase or external service)
    // If accessing auth pages while logged in, redirect to dashboard
    if (isAuthenticated && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
      const origin = getBaseUrl(request);
      return NextResponse.redirect(new URL('/dashboard', origin))
    }

    // If authenticated user accesses root, redirect to dashboard
    if (isAuthenticated && request.nextUrl.pathname === '/') {
      const origin = getBaseUrl(request);
      return NextResponse.redirect(new URL('/dashboard', origin))
    }

    // Add authentication info to response headers
    supabaseResponse.headers.set('x-user-authenticated', 'true')
    
    // Add Supabase user info if available
    if (supabaseUser?.id) {
      supabaseResponse.headers.set('x-supabase-user-id', supabaseUser.id)
    }
    
    // Add external auth user context if available
    if (externalUser) {
      supabaseResponse.headers.set('x-user-context', JSON.stringify(externalUser))
      supabaseResponse.headers.set('x-external-auth', 'true')
    }

    return supabaseResponse

  } catch (error) {
    console.error(`[Middleware:${requestId}] Middleware error:`, error)
    
    // On error, allow public routes but redirect protected routes to appropriate login
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
      // Try external auth first, then fallback to Supabase
      const accessToken = request.cookies.get('access_token')?.value;
      const refreshToken = request.cookies.get('refresh_token')?.value;
      
      if (!accessToken && !refreshToken) {
        const loginUrl = `https://makebell-supabase.onrender.com/auth/login?redirect_url=${encodeURIComponent(getBaseUrl(request))}&app_name=Meeting%20Minutes%20AI`;
        return NextResponse.redirect(loginUrl);
      } else {
        const origin = getBaseUrl(request);
        const loginUrl = new URL('/login', origin);
        loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.redirect(loginUrl);
      }
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
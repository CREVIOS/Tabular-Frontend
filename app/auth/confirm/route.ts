import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Helper function to get the appropriate base URL
function getBaseUrl(request: NextRequest) {
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
  
  // Fallback: your known production URL (NEVER use 0.0.0.0)
  console.log(`[getBaseUrl] Using fallback URL`);
  return 'https://tabular-frontend.onrender.com';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('[Auth Confirm] Processing request with token:', !!token, 'type:', type, 'next:', next)

  if (!token || !type) {
    console.error('[Auth Confirm] Missing token or type')
    const origin = getBaseUrl(request);
    return NextResponse.redirect(new URL('/login?error=invalid_token', origin))
  }

  // Create the response object first
  const redirectUrl = next.startsWith('/') ? next : '/dashboard'
  const origin = getBaseUrl(request);
  const response = NextResponse.redirect(new URL(redirectUrl, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    console.log('[Auth Confirm] Attempting to verify OTP with token hash')
    
    // Verify the magic link token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'magiclink',
    })

    if (error) {
      console.error('[Auth Confirm] Auth confirmation error:', error.message)
      const origin = getBaseUrl(request);
      return NextResponse.redirect(new URL(`/login?error=auth_failed&details=${encodeURIComponent(error.message)}`, origin))
    }

    if (!data.user) {
      console.error('[Auth Confirm] No user data returned from verification')
      const origin = getBaseUrl(request);
      return NextResponse.redirect(new URL('/login?error=no_user_data', origin))
    }

    console.log('[Auth Confirm] Auth confirmation successful for user:', data.user.email)
    console.log('[Auth Confirm] Redirecting to:', redirectUrl)
    
    return response

  } catch (error) {
    console.error('[Auth Confirm] Auth confirmation exception:', error)
    const origin = getBaseUrl(request);
    return NextResponse.redirect(new URL(`/login?error=auth_exception&details=${encodeURIComponent((error as Error).message)}`, origin))
  }
}
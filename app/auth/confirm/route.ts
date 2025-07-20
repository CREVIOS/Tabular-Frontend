import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('[Auth Confirm] Processing request with token:', !!token, 'type:', type, 'next:', next)

  if (!token || !type) {
    console.error('[Auth Confirm] Missing token or type')
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
  }

  // Create the response object first
  const redirectUrl = next.startsWith('/') ? next : '/dashboard'
  const response = NextResponse.redirect(new URL(redirectUrl, request.url))

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
      return NextResponse.redirect(new URL(`/login?error=auth_failed&details=${encodeURIComponent(error.message)}`, request.url))
    }

    if (!data.user) {
      console.error('[Auth Confirm] No user data returned from verification')
      return NextResponse.redirect(new URL('/login?error=no_user_data', request.url))
    }

    console.log('[Auth Confirm] Auth confirmation successful for user:', data.user.email)
    console.log('[Auth Confirm] Redirecting to:', redirectUrl)
    
    return response

  } catch (error) {
    console.error('[Auth Confirm] Auth confirmation exception:', error)
    return NextResponse.redirect(new URL(`/login?error=auth_exception&details=${encodeURIComponent((error as Error).message)}`, request.url))
  }
}
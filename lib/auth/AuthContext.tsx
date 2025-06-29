'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

// Types
export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, userData?: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<boolean>
  checkAuth: () => Promise<boolean>
  getAuthToken: () => Promise<string | null>
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register', 
  '/forgot-password',
  '/reset-password'
]

const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false
  })
  
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Get current auth token
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }, [supabase.auth])

  // Refresh session
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('Session refresh failed:', error)
        return false
      }

      if (session) {
        setAuthState(prev => ({
          ...prev,
          user: session.user,
          session: session,
          loading: false
        }))
        return true
      }
      
      return false
    } catch (error) {
      console.error('Session refresh error:', error)
      return false
    }
  }, [supabase.auth])

  // Check authentication status
  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Auth check failed:', error)
        return false
      }

      const isAuthenticated = Boolean(session?.user)
      
      setAuthState(prev => ({
        ...prev,
        user: session?.user || null,
        session: session,
        loading: false,
        initialized: true
      }))

      return isAuthenticated
    } catch (error) {
      console.error('Auth check error:', error)
      setAuthState(prev => ({
        ...prev,
        user: null,
        session: null,
        loading: false,
        initialized: true
      }))
      return false
    }
  }, [supabase.auth])

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }))
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data.session) {
        setAuthState({
          user: data.user,
          session: data.session,
          loading: false,
          initialized: true
        })
        
        // Redirect to dashboard after successful login
        router.push('/dashboard')
        return { success: true }
      }

      return { success: false, error: 'No session created' }
    } catch (error) {
      console.error('Sign in error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sign in failed' 
      }
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }))
    }
  }, [supabase.auth, router])

  // Sign up
  const signUp = useCallback(async (email: string, password: string, userData?: Record<string, unknown>) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }))
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // For email confirmation flow
      if (data.user && !data.session) {
        return { 
          success: true, 
          error: 'Please check your email for confirmation link' 
        }
      }

      if (data.session) {
        setAuthState({
          user: data.user,
          session: data.session,
          loading: false,
          initialized: true
        })
        
        router.push('/dashboard')
        return { success: true }
      }

      return { success: false, error: 'Sign up failed' }
    } catch (error) {
      console.error('Sign up error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sign up failed' 
      }
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }))
    }
  }, [supabase.auth, router])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      
      setAuthState({
        user: null,
        session: null,
        loading: false,
        initialized: true
      })
      
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }, [supabase.auth, router])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const isAuthenticated = await checkAuth()
        
        if (!mounted) return

        // Handle routing based on auth state
        if (!isAuthenticated && !isPublicRoute(pathname)) {
          router.push('/login')
        } else if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            loading: false,
            initialized: true
          }))
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
    }
  }, [checkAuth, pathname, router])

  // Listen to auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)

      setAuthState(prev => ({
        ...prev,
        user: session?.user || null,
        session: session,
        loading: false,
        initialized: true
      }))

      // Handle auth events
      switch (event) {
        case 'SIGNED_IN':
          if (!isPublicRoute(pathname)) {
            // Stay on current page if it's protected
            break
          }
          router.push('/dashboard')
          break
        
        case 'SIGNED_OUT':
          router.push('/login')
          break
        
        case 'TOKEN_REFRESHED':
          console.log('Token refreshed successfully')
          break
        
        case 'USER_UPDATED':
          console.log('User updated')
          break
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, router, pathname])

  // Auto-refresh token
  useEffect(() => {
    if (!authState.session) return

    const refreshInterval = setInterval(async () => {
      const tokenExpiry = authState.session?.expires_at
      if (tokenExpiry) {
        const expiryTime = tokenExpiry * 1000
        const currentTime = Date.now()
        const timeUntilExpiry = expiryTime - currentTime
        
        // Refresh token 5 minutes before expiry
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log('Auto-refreshing token...')
          await refreshSession()
        }
      }
    }, 60000) // Check every minute

    return () => clearInterval(refreshInterval)
  }, [authState.session, refreshSession])

  const contextValue: AuthContextType = {
    ...authState,
    signIn,
    signUp,
    signOut,
    refreshSession,
    checkAuth,
    getAuthToken
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading, initialized } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (initialized && !loading && !user) {
        router.push('/login')
      }
    }, [user, loading, initialized, router])

    if (loading || !initialized) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    if (!user) {
      return null // Will redirect in useEffect
    }

    return <WrappedComponent {...props} />
  }
} 
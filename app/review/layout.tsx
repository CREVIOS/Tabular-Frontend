'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Sidebar, SidebarProvider } from '@/components/sidebar'
import Navbar from '@/components/navbar'

function ReviewContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Check if we're on a review detail page (e.g., /review/some-id)
  const isReviewDetailPage = pathname.match(/^\/review\/[^\/]+$/)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          setIsAuthenticated(false)
          router.push('/login')
          return
        }
        
        setCurrentUser(session.user)
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Authentication check failed:', error)
        setIsAuthenticated(false)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false)
          router.push('/login')
        } else if (session) {
          setCurrentUser(session.user)
          setIsAuthenticated(true)
        }
      }
    )
    
    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      setCurrentUser(null)
      setIsAuthenticated(false)
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Convert Supabase user to navbar user format
  const navbarUser = currentUser ? {
    id: currentUser.id,
    email: currentUser.email || '',
    full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name,
    is_active: true,
    created_at: currentUser.created_at,
    last_login: currentUser.last_sign_in_at || undefined
  } : null

  // If it's a review detail page, render with navbar but without sidebar
  if (isReviewDetailPage) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <Navbar
          user={navbarUser}
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
          showUserInfo={true}
          showBackButton={true}
          onBack={() => router.push('/review')}
        />
        
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar className="border-r" />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar
          user={navbarUser}
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
          showUserInfo={true}
        />
        
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <ReviewContent>
        {children}
      </ReviewContent>
    </SidebarProvider>
  )
} 
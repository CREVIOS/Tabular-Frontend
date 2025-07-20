'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/sidebar'
import Navbar from '@/components/navbar'

function DocumentsContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const { isMobileOpen } = useSidebar()
  
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          setIsAuthenticated(false)
          router.push('/login')
          return
        }
        
        if (!session) {
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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - responsive with mobile overlay */}
      <Sidebar className="border-r" />
      
      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Navbar */}
        <div className="transition-all duration-300 ease-in-out">
          <Navbar
            user={navbarUser}
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            onLogout={handleLogout}
            showUserInfo={true}
          />
        </div>

        {/* Mobile Header with Trigger - only show on mobile when sidebar is closed */}
        <div className={`
          fixed top-16 left-0 right-0 z-30 bg-white border-b border-gray-200 p-4 md:hidden
          ${isMobileOpen ? 'hidden' : 'block'}
        `}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-gray-900">Documents</h1>
            </div>
          </div>
        </div>
        
        {/* Main content with responsive padding */}
        <main className={`
          flex-1 overflow-y-auto
          pt-16 md:pt-0
          ${!isMobileOpen ? 'pt-32 md:pt-0' : 'pt-16 md:pt-0'}
        `}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <DocumentsContent>
        {children}
      </DocumentsContent>
    </SidebarProvider>
  )
} 
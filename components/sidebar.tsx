// components/layout/sidebar.tsx
"use client"
import * as React from "react"
import {
  BarChart3,
  Table,
  Shield,
  FolderOpen,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { File, Review } from "@/types"


const sidebarItems = [
  {
    title: "Dashboard",
    icon: BarChart3,
    href: "/",
    description: "Overview & Stats",
  },
  {
    title: "Reviews",
    icon: Table,
    href: "/review",
    description: "AI Data Extraction",
    highlight: true,
  },
  {
    title: "Documents",
    icon: FolderOpen,
    href: "/documents",
    description: "Browse & Organize",
  },
]


interface SidebarProps {
  className?: string
}

interface SidebarContextType {
  isCollapsed: boolean
  isMobileOpen: boolean
  toggleCollapsed: () => void
  toggleMobile: () => void
  closeMobile: () => void
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)

  const toggleCollapsed = React.useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  const toggleMobile = React.useCallback(() => {
    setIsMobileOpen(prev => !prev)
  }, [])

  const closeMobile = React.useCallback(() => {
    setIsMobileOpen(false)
  }, [])

  // Close mobile sidebar when route changes
  const pathname = usePathname()
  React.useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Handle escape key to close mobile sidebar
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isMobileOpen])

  // Prevent body scroll when mobile sidebar is open
  React.useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileOpen])

  const value = React.useMemo(() => ({
    isCollapsed,
    isMobileOpen,
    toggleCollapsed,
    toggleMobile,
    closeMobile
  }), [isCollapsed, isMobileOpen, toggleCollapsed, toggleMobile, closeMobile])

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { toggleMobile } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMobile}
      className={cn("md:hidden", className)}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  )
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentUser, setCurrentUser] = React.useState<any>(null)
  const [stats, setStats] = React.useState({
    activeReviews: 0,
    processingFiles: 0
  })

  React.useEffect(() => {
    const supabase = createClient()
    
    // Get current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Current user in sidebar:', user)
      setCurrentUser(user)
    }
    
    getUser()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user)
      setCurrentUser(session?.user || null)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Separate useEffect for fetching stats when user is authenticated
  React.useEffect(() => {
    if (currentUser) {
      fetchQuickStats()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  // Debug: Log when currentUser state changes
  React.useEffect(() => {
    console.log('Current user state updated:', currentUser)
  }, [currentUser])

  const fetchQuickStats = React.useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) return

      const [reviewsResponse, filesResponse] = await Promise.all([
        fetch('https://app2.makebell.com:8443/api/reviews/', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch('https://app2.makebell.com:8443/api/files/', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ])

      if (reviewsResponse.ok && filesResponse.ok) {
        const [reviewsData, filesData] = await Promise.all([
          reviewsResponse.json(),
          filesResponse.json()
        ])

        const reviews = Array.isArray(reviewsData.reviews) ? reviewsData.reviews : (Array.isArray(reviewsData) ? reviewsData : [])
        const activeReviews = reviews.filter((r: Review) => r.status === 'processing').length
        const processingFiles = filesData.filter((f: File) => f.status === 'processing' || f.status === 'queued').length

        setStats({ activeReviews, processingFiles })
      }
    } catch (error) {
      console.error('Failed to fetch sidebar stats:', error)
    }
  }, [])




  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out md:relative md:z-auto",
        "flex flex-col",
        // Mobile styles
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        // Desktop styles
        isCollapsed ? "md:w-16" : "md:w-64",
        "w-64", // Always full width on mobile when open
        className
      )}>
        
        {/* Header */}
        <div className={cn(
          "border-b border-gray-200 transition-all duration-300",
          isCollapsed ? "p-3" : "p-6"
        )}>
          <div className="flex items-center justify-between">
            <div className={cn(
              "flex items-center gap-3 transition-all duration-300",
              isCollapsed && "justify-center"
            )}>
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">Tabular</h2>
                  <p className="text-sm text-blue-600 font-medium">Reviews</p>
                </div>
              )}
            </div>
            
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeMobile}
              className="md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Collapse toggle for desktop */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className={cn(
                "hidden md:flex transition-all duration-300",
                isCollapsed && "mx-auto"
              )}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <nav className={cn("space-y-1", isCollapsed ? "px-2" : "px-3")}>
            {sidebarItems.map((item) => {
              const isActive = isActiveRoute(item.href)
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full transition-all duration-200 relative group",
                      isCollapsed 
                        ? "h-10 px-2 justify-center" 
                        : "h-12 px-4 justify-start",
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg transition-colors flex-shrink-0",
                      isActive 
                        ? "bg-blue-100" 
                        : "bg-gray-100 group-hover:bg-gray-200",
                      isCollapsed ? "mr-0" : "mr-3"
                    )}>
                      <item.icon className={cn(
                        "h-4 w-4",
                        isActive ? "text-blue-600" : "text-gray-500"
                      )} />
                    </div>
                    
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.title}</span>
                          {item.highlight && !isActive && (
                            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 text-xs">
                              AI
                            </Badge>
                          )}
                          {item.href === '/review' && stats.activeReviews > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 text-xs">
                              {stats.activeReviews}
                            </Badge>
                          )}
                          {item.href === '/documents' && stats.processingFiles > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-700 text-xs">
                              {stats.processingFiles}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 text-left">
                          {item.description}
                        </div>
                      </div>
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                        {item.title}
                        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 w-0 h-0 border-r-4 border-r-gray-900 border-y-4 border-y-transparent"></div>
                      </div>
                    )}
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* Quick Actions */}
          {/* {!isCollapsed && (
            <div className="px-3 mt-8 space-y-3">
              <div className="px-3 mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h3>
              </div>
              
              {quickActions.map((action) => (
                <Button
                  key={action.action}
                  onClick={() => handleQuickAction(action.action)}
                  className={cn("w-full justify-start text-white shadow-sm", action.color)}
                >
                  <action.icon className="h-4 w-4 mr-3" />
                  {action.title}
                </Button>
              ))}
            </div>
          )} */}
    </div>

        {/* User Section */}
        {/* <div className="border-t border-gray-200 p-4">
          {currentUser && !isCollapsed && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentUser.user_metadata?.full_name || currentUser.email}
                </p>
                <p className="text-xs text-gray-500">Account Active</p>
              </div>
            </div>
          )}
          
          <Button
            variant="outline"
            className={cn(
              "w-full text-gray-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all",
              isCollapsed 
                ? "h-10 px-2 justify-center" 
                : "h-11 justify-start"
            )}
            onClick={handleLogout}
          >
            <div className={cn(
              "p-2 rounded-lg bg-gray-100 group-hover:bg-red-100 transition-colors",
              isCollapsed ? "mr-0" : "mr-3"
            )}>
              <LogOut className="h-4 w-4" />
            </div>
            {!isCollapsed && "Sign Out"}
          </Button>
        </div> */}
      </div>
    </>
  )
}

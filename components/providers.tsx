'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from '@/components/ui/sonner'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }))

  // Load React Query Devtools only in development and only on the client
  const ReactQueryDevtools = useMemo(
    () =>
      process.env.NODE_ENV !== 'production'
        ? dynamic(() => import('@tanstack/react-query-devtools').then(m => m.ReactQueryDevtools), { ssr: false })
        : null,
    []
  )

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {ReactQueryDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
} 
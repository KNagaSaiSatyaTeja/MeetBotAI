'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useEffect } from 'react'
import { useAuth } from '@/store/auth'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const { fetchMe, token, _hasHydrated } = useAuth()
  
  useEffect(() => {
    // Only call fetchMe if the store has been hydrated and we have a token
    if (_hasHydrated && token) {
      fetchMe()
    }
  }, [fetchMe, token, _hasHydrated])
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      disableTransitionOnChange
    >
      {children}
      <Toaster position="top-right" />
    </ThemeProvider>
  )
}

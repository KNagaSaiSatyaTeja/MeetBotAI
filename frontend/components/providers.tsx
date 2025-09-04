'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useEffect } from 'react'
import { useAuth } from '@/store/auth'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const { fetchMe } = useAuth()
  useEffect(() => {
    fetchMe()
  }, [fetchMe])
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster position="top-right" />
    </ThemeProvider>
  )
}

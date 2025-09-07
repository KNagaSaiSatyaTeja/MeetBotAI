'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Avatar } from '@/components/ui/avatar'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, isAdmin, token, _hasHydrated } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    console.log('🔍 AppLayout auth check:', { 
      hasHydrated: _hasHydrated, 
      hasToken: !!token, 
      hasUser: !!user,
      userEmail: user?.email 
    })
    
    // Only redirect to login if:
    // 1. Store has been hydrated (to avoid redirecting during initial load)
    // 2. No token exists (user is not authenticated)
    // 3. No user object exists (authentication failed)
    if (_hasHydrated && !token && !user) {
      console.log('🔒 No authentication found, redirecting to login')
      router.replace('/login')
    }
  }, [user, token, _hasHydrated, router])
  
  // Show loading state while store is hydrating
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  // Show loading state if we have a token but no user yet (fetchMe in progress)
  if (token && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">AI</span>
              </div>
              <div>
                <span className="font-bold text-xl text-gray-900">MeetBot</span>
                <p className="text-xs text-gray-500">AI Meeting Assistant</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            <a href="/" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </a>
            <a href="/meetings" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Meetings
            </a>
            <a href="/bots" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Bot Management
            </a>
            {isAdmin() && (
              <a href="/analytics" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Analytics
              </a>
            )}
            <a href="/api-management" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              API Tokens
            </a>
            <a href="/search" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </a>
            <a href="/settings" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </a>
            
            {/* Admin-only navigation */}
            {isAdmin() && (
              <>
                <div className="pt-6 pb-3">
                  <div className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-gray-200 pt-4">
                    Administration
                  </div>
                </div>
                <a href="/admin" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Admin Dashboard
                </a>
                <a href="/admin/users" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  User Management
                </a>
                <a href="/admin/monitoring" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  System Monitor
                </a>
                <a href="/admin/health" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Health Check
                </a>
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3 mb-3">
              <Avatar user={user} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.email || 'Guest'}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{user?.role?.toLowerCase() || ''}</p>
              </div>
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => router.push('/settings')} 
                className="flex-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-white px-2 py-1 rounded transition-colors"
              >
                Settings
              </button>
              <button 
                onClick={logout} 
                className="flex-1 text-xs text-red-600 hover:text-red-800 hover:bg-white px-2 py-1 rounded transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64 min-h-screen bg-gray-50">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">AI Meeting Bot</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search meetings..."
                  className="w-64 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <Avatar user={user} size="sm" />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}

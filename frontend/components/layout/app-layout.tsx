'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, isAdmin } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!user) {
      router.replace('/login')
    }
  }, [user, router])
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="font-semibold text-lg">MeetBot</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-2">
            <a href="/" className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-900">
              <span className="mr-3">📊</span>
              Dashboard
            </a>
            <a href="/meetings" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
              <span className="mr-3">🎥</span>
              Meetings
            </a>
            <a href="/bots" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
              <span className="mr-3">🤖</span>
              Bot Management
            </a>
            <a href="/analytics" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
              <span className="mr-3">📈</span>
              Analytics
            </a>
            <a href="/api-management" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
              <span className="mr-3">🔑</span>
              API Tokens
            </a>
            <a href="/search" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
              <span className="mr-3">🔍</span>
              Search
            </a>
            <a href="/settings" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
              <span className="mr-3">⚙️</span>
              Settings
            </a>
            
            {/* Admin-only navigation */}
            {isAdmin() && (
              <>
                <div className="pt-4 pb-2">
                  <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Admin
                  </div>
                </div>
                <a href="/admin" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-3">👑</span>
                  Admin Dashboard
                </a>
                <a href="/admin/users" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-3">👥</span>
                  User Management
                </a>
                <a href="/admin/monitoring" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-3">📊</span>
                  System Monitor
                </a>
                <a href="/admin/health" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-3">💚</span>
                  Health Check
                </a>
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email || 'Guest'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.role || ''}</p>
              </div>
            </div>
            <button onClick={logout} className="mt-3 text-xs text-blue-600">Sign out</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {/* Top bar */}
        <div className="topbar">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold">AI Meeting Bot</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search meetings..."
                  className="w-64 pl-3 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-400">🔍</span>
                </div>
              </div>
              <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
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

'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'

interface SystemHealth {
  users: { total: number; active: number; inactive: number }
  meetings: { total: number; scheduled: number; inProgress: number; completed: number }
  apiTokens: { total: number; active: number; revoked: number }
  bots: { active: number; idle: number; failed: number }
}

export default function AdminDashboardPage() {
  const { token, isAdmin } = useAuth()
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !isAdmin()) return

    const fetchHealth = async () => {
      try {
        setLoading(true)
        const data = await Api.admin.getHealth(token)
        setHealth(data)
      } catch (e: any) {
        setError(e.message || 'Failed to load system health')
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
  }, [token, isAdmin])

  if (!isAdmin()) {
    return (
      <AppLayout>
        <div className="container py-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-red-600">Access Denied</h1>
            <p className="text-gray-600 mt-2">You need admin privileges to access this page.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse" />
                <div className="h-8 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : health ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Users Card */}
            <div className="border rounded-lg p-4">
              <div className="font-medium text-gray-700 mb-2">Users</div>
              <div className="text-2xl font-bold text-blue-600 mb-2">{health.users.total}</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="text-green-600">{health.users.active}</span>
                </div>
                <div className="flex justify-between">
                  <span>Inactive:</span>
                  <span className="text-red-600">{health.users.inactive}</span>
                </div>
              </div>
            </div>

            {/* Meetings Card */}
            <div className="border rounded-lg p-4">
              <div className="font-medium text-gray-700 mb-2">Meetings</div>
              <div className="text-2xl font-bold text-green-600 mb-2">{health.meetings.total}</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Scheduled:</span>
                  <span className="text-yellow-600">{health.meetings.scheduled}</span>
                </div>
                <div className="flex justify-between">
                  <span>In Progress:</span>
                  <span className="text-blue-600">{health.meetings.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="text-green-600">{health.meetings.completed}</span>
                </div>
              </div>
            </div>

            {/* API Tokens Card */}
            <div className="border rounded-lg p-4">
              <div className="font-medium text-gray-700 mb-2">API Tokens</div>
              <div className="text-2xl font-bold text-purple-600 mb-2">{health.apiTokens.total}</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="text-green-600">{health.apiTokens.active}</span>
                </div>
                <div className="flex justify-between">
                  <span>Revoked:</span>
                  <span className="text-red-600">{health.apiTokens.revoked}</span>
                </div>
              </div>
            </div>

            {/* Bots Card */}
            <div className="border rounded-lg p-4">
              <div className="font-medium text-gray-700 mb-2">Bot Status</div>
              <div className="text-2xl font-bold text-orange-600 mb-2">{health.bots.active + health.bots.idle + health.bots.failed}</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="text-green-600">{health.bots.active}</span>
                </div>
                <div className="flex justify-between">
                  <span>Idle:</span>
                  <span className="text-gray-600">{health.bots.idle}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className="text-red-600">{health.bots.failed}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="border rounded-lg p-4">
            <div className="font-medium mb-4">Quick Actions</div>
            <div className="space-y-2">
              <a href="/admin/users" className="block w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-md text-blue-700 transition-colors">
                Manage Users
              </a>
              <a href="/admin/monitoring" className="block w-full text-left px-4 py-2 bg-green-50 hover:bg-green-100 rounded-md text-green-700 transition-colors">
                System Monitoring
              </a>
              <a href="/admin/health" className="block w-full text-left px-4 py-2 bg-purple-50 hover:bg-purple-100 rounded-md text-purple-700 transition-colors">
                Health Check
              </a>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="font-medium mb-4">System Status</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Server</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Bot Workers</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Healthy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}



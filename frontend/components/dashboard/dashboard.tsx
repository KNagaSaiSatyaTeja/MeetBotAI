'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'

interface DashboardData {
  meetings: {
    total: number
    scheduled: number
    inProgress: number
    completed: number
  }
  bots: {
    active: number
    idle: number
    failed: number
  }
  recentMeetings: Array<{
    id: string
    title: string
    platform: string
    status: string
    createdAt: string
    scheduledAt?: string
  }>
}

export function Dashboard() {
  const { token } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      console.log('🔍 Dashboard useEffect called, token:', !!token)
      if (!token) {
        console.log('❌ No token available for dashboard')
        return
      }
      
      setLoading(true)
      try {
        console.log('📡 Loading meetings data...')
        // Load meetings data
        const meetingsRes = await Api.listMeetings(token, { limit: 10 })
        console.log('📊 Meetings response:', meetingsRes)
        const meetings = meetingsRes.data || meetingsRes.items || meetingsRes || []
        console.log('📋 Processed meetings:', meetings)
        
        console.log('📡 Loading bots data...')
        // Load bots data
        const botsRes = await Api.b2b.listBots(token)
        console.log('🤖 Bots response:', botsRes)
        const bots = botsRes.bots || botsRes || []
        console.log('🤖 Processed bots:', bots)
        
        // Calculate statistics
        const meetingsStats = {
          total: meetings.length,
          scheduled: meetings.filter((m: any) => m.status === 'SCHEDULED').length,
          inProgress: meetings.filter((m: any) => m.status === 'IN_PROGRESS').length,
          completed: meetings.filter((m: any) => m.status === 'COMPLETED').length,
        }
        
        const botsStats = {
          active: bots.filter((b: any) => b.status === 'active').length,
          idle: bots.filter((b: any) => b.status === 'idle').length,
          failed: bots.filter((b: any) => b.status === 'failed').length,
        }
        
        setData({
          meetings: meetingsStats,
          bots: botsStats,
          recentMeetings: meetings.slice(0, 5)
        })
      } catch (e: any) {
        console.error('❌ Failed to load dashboard data:', e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadDashboardData()
  }, [token])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
      case 'IN_PROGRESS': return 'bg-blue-50 text-blue-800 ring-blue-600/20'
      case 'COMPLETED': return 'bg-green-50 text-green-700 ring-green-600/20'
      case 'FAILED': return 'bg-red-50 text-red-800 ring-red-600/20'
      case 'CANCELLED': return 'bg-gray-50 text-gray-800 ring-gray-600/20'
      default: return 'bg-gray-50 text-gray-800 ring-gray-600/20'
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'google-meet': return '🟢'
      case 'zoom': return '🔵'
      case 'teams': return '🟣'
      default: return '📹'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-8 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-48" />
                  <div className="h-3 bg-gray-200 rounded w-32" />
                </div>
                <div className="h-6 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Meetings</h3>
          </div>
          <div className="text-2xl font-bold">{data?.meetings.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {data?.meetings.completed || 0} completed
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Active Bots</h3>
          </div>
          <div className="text-2xl font-bold">{data?.bots.active || 0}</div>
          <p className="text-xs text-muted-foreground">
            {data?.bots.idle || 0} idle, {data?.bots.failed || 0} failed
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">In Progress</h3>
          </div>
          <div className="text-2xl font-bold">{data?.meetings.inProgress || 0}</div>
          <p className="text-xs text-muted-foreground">
            {data?.meetings.scheduled || 0} scheduled
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Success Rate</h3>
          </div>
          <div className="text-2xl font-bold">
            {data?.meetings.total ? Math.round((data.meetings.completed / data.meetings.total) * 100) : 0}%
          </div>
          <p className="text-xs text-muted-foreground">
            Meeting completion rate
          </p>
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">Recent Meetings</h3>
          <p className="text-sm text-muted-foreground">Latest meeting recordings and transcriptions</p>
        </div>
        <div className="p-6 pt-0">
          {data?.recentMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No meetings yet. <a href="/meetings" className="text-blue-600 hover:underline">Create your first meeting</a>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.recentMeetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{getPlatformIcon(meeting.platform)}</span>
                      <p className="text-sm font-medium">{meeting.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {meeting.scheduledAt
                        ? `${new Date(meeting.scheduledAt).toLocaleDateString()} • ${meeting.platform.replace('-', ' ')}`
                        : `${new Date(meeting.createdAt).toLocaleDateString()} • ${meeting.platform.replace('-', ' ')}`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(meeting.status)}`}>
                      {meeting.status.replace('_', ' ').toLowerCase()}
                    </span>
                    <a 
                      href={`/meetings/${meeting.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


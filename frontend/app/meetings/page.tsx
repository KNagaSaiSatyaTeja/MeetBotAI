'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'

interface Meeting {
  id: string
  title: string
  platform: string
  status: string
  scheduledAt?: string
  createdAt: string
  meetingLink?: string
}

export default function MeetingsPage() {
  const { token } = useAuth()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('google-meet')
  const [meetingLink, setMeetingLink] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  useEffect(() => {
    async function load() {
      if (!token) return
      setLoading(true)
      try {
        const res = await Api.listMeetings(token, { limit: 50 })
        console.log('📊 Meetings API response:', res)
        const meetingsData = res.data || res.items || res || []
        console.log('📋 Processed meetings data:', meetingsData)
        setMeetings(meetingsData)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setCreateLoading(true)
    try {
      const newMeeting = await Api.createMeeting(token, {
        title,
        platform,
        meetingLink: meetingLink || undefined,
        scheduledAt: scheduledAt || undefined,
      })

      setMeetings([newMeeting, ...meetings])
      setShowCreateForm(false)
      setTitle('')
      setMeetingLink('')
      setScheduledAt('')
      setPlatform('google-meet')
    } catch (e: any) {
      alert(e.message || 'Failed to create meeting')
    } finally {
      setCreateLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
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

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">My Meetings</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Add Meeting
          </button>
        </div>

        {/* Create Meeting Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Add New Meeting</h2>
              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Weekly Team Standup"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="google-meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                    <option value="teams">Microsoft Teams</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Link (Optional)</label>
                  <input
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    type="url"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time (Optional)</label>
                  <input
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    type="datetime-local"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {createLoading ? 'Creating...' : 'Create Meeting'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-6 bg-gray-100 rounded mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">No meetings yet</div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
            >
              Create Your First Meeting
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(meetings) ? meetings.map((meeting) => (
              <a
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getPlatformIcon(meeting.platform)}</span>
                    <span className="text-sm text-gray-500 capitalize">
                      {meeting.platform.replace('-', ' ')}
                    </span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(meeting.status)}`}>
                    {meeting.status.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
                <div className="font-medium text-gray-900 mb-2">{meeting.title}</div>
                <div className="text-xs text-gray-500">
                  {meeting.scheduledAt
                    ? `Scheduled: ${new Date(meeting.scheduledAt).toLocaleString()}`
                    : `Created: ${new Date(meeting.createdAt).toLocaleString()}`}
                </div>
                {meeting.meetingLink && (
                  <div className="text-xs text-blue-600 mt-1 truncate">
                    Has meeting link
                  </div>
                )}
              </a>
            )) : (
              <div className="col-span-full text-center text-gray-500 py-8">
                No meetings data available
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}



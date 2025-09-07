'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'

interface Meeting {
  id: string
  title: string
  platform: string
  status: string
  meetingLink?: string
  scheduledAt?: string
  startedAt?: string
  endedAt?: string
  createdAt: string
  updatedAt: string
  recordings: any[]
  transcripts: any[]
  summaries: any[]
  bots: any[]
}

export default function MeetingDetailPage() {
  const params = useParams() as { id: string }
  const { token } = useAuth()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!token || !params?.id) return
      setLoading(true)
      try {
        const res = await Api.getMeeting(token, params.id)
        setMeeting(res)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, params?.id])

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

  if (loading) {
    return (
      <AppLayout>
        <div className="container py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
        {meeting && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-gray-900">{meeting.title}</h1>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getPlatformIcon(meeting.platform)}</span>
                    <span className="text-sm text-gray-500 capitalize">
                      {meeting.platform.replace('-', ' ')}
                    </span>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(meeting.status)}`}>
                    {meeting.status.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
              </div>
              {meeting.meetingLink && (
                <a
                  href={meeting.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                >
                  Join Meeting
                </a>
              )}
            </div>

            {/* Meeting Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border rounded-lg p-4">
                <div className="text-sm text-gray-500">Created</div>
                <div className="font-medium">{new Date(meeting.createdAt).toLocaleString()}</div>
              </div>
              {meeting.scheduledAt && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-sm text-gray-500">Scheduled</div>
                  <div className="font-medium">{new Date(meeting.scheduledAt).toLocaleString()}</div>
                </div>
              )}
              {meeting.startedAt && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-sm text-gray-500">Started</div>
                  <div className="font-medium">{new Date(meeting.startedAt).toLocaleString()}</div>
                </div>
              )}
              {meeting.endedAt && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-sm text-gray-500">Ended</div>
                  <div className="font-medium">{new Date(meeting.endedAt).toLocaleString()}</div>
                </div>
              )}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recordings */}
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Recordings</h2>
                {meeting.recordings.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">No recordings available</div>
                ) : (
                  <div className="space-y-3">
                    {meeting.recordings.map((recording: any) => (
                      <div key={recording.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium">Recording {recording.id.slice(-8)}</div>
                          <div className="text-sm text-gray-500">
                            {recording.hasVideo ? 'Video + Audio' : 'Audio only'}
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transcripts */}
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Transcripts</h2>
                {meeting.transcripts.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">No transcripts available</div>
                ) : (
                  <div className="space-y-3">
                    {meeting.transcripts.map((transcript: any) => (
                      <div key={transcript.id} className="p-3 bg-gray-50 rounded">
                        <div className="font-medium mb-2">Transcript {transcript.id.slice(-8)}</div>
                        <div className="text-sm text-gray-600 line-clamp-3">
                          {transcript.text}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Language: {transcript.language} • Accuracy: {transcript.accuracy ? `${(transcript.accuracy * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summaries */}
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Summaries & MoM</h2>
                {meeting.summaries.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">No summaries available</div>
                ) : (
                  <div className="space-y-3">
                    {meeting.summaries.map((summary: any) => (
                      <div key={summary.id} className="p-3 bg-gray-50 rounded">
                        <div className="font-medium mb-2">Summary {summary.id.slice(-8)}</div>
                        <div className="text-sm text-gray-600 line-clamp-4">
                          {summary.content}
                        </div>
                        {summary.mom && (
                          <div className="mt-2 p-2 bg-blue-50 rounded">
                            <div className="text-xs font-medium text-blue-800 mb-1">Minutes of Meeting:</div>
                            <div className="text-xs text-blue-700">{summary.mom}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bot Activity */}
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Bot Activity</h2>
                {meeting.bots.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">No bot activity</div>
                ) : (
          <div className="space-y-3">
                    {meeting.bots.map((bot: any) => (
                      <div key={bot.id} className="p-3 bg-gray-50 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">Bot {bot.id.slice(-8)}</div>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(bot.status)}`}>
                            {bot.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Platform: {bot.platform} • Started: {new Date(bot.startedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}



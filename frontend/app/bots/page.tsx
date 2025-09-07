'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'

interface Bot {
  id: string
  meetingId: string
  status: 'joining' | 'active' | 'ending' | 'failed'
  platform: string
  startTime: string
  lastActivity: string
  recordingStarted: boolean
  recordingFile?: string
  transcript?: string
  mom?: string
}

export default function BotsPage() {
  const { token } = useAuth()
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)

  // Form state
  const [meetingLink, setMeetingLink] = useState('')
  const [title, setTitle] = useState('')
  const [displayName, setDisplayName] = useState('MeetingBot AI')
  const [passcode, setPasscode] = useState('')
  const [recording, setRecording] = useState(true)
  const [transcription, setTranscription] = useState(true)
  const [summary, setSummary] = useState(true)

  useEffect(() => {
    async function load() {
      if (!token) return
      setLoading(true)
      try {
        const res = await Api.b2b.listBots(token)
        setBots(res.bots || res || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setJoinLoading(true)
    try {
      const newBot = await Api.b2b.createBot(token, {
        meetingLink,
        title: title || undefined,
        displayName,
        passcode: passcode || undefined,
        recording,
        transcription,
        summary,
        language: 'en'
      })

      setBots([newBot, ...bots])
      setShowJoinForm(false)
      setMeetingLink('')
      setTitle('')
      setPasscode('')
    } catch (e: any) {
      alert(e.message || 'Failed to join meeting')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleEndBot = async (botId: string) => {
    if (!token) return

    try {
      await Api.b2b.endBot(token, botId)
      setBots(bots.filter(bot => bot.id !== botId))
    } catch (e: any) {
      alert(e.message || 'Failed to end bot')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'joining': return 'bg-yellow-100 text-yellow-800'
      case 'active': return 'bg-green-100 text-green-800'
      case 'ending': return 'bg-orange-100 text-orange-800'
      case 'failed': return 'bg-red-100 text-red-800'
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
          <h1 className="text-2xl font-semibold">Bot Management</h1>
          <button
            onClick={() => setShowJoinForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Join Meeting
          </button>
        </div>

        {/* Join Meeting Form */}
        {showJoinForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Join Meeting with Bot</h2>
              <form onSubmit={handleJoinMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Link *</label>
                  <input
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    required
                    type="url"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Weekly Team Standup"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bot Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="MeetingBot AI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Passcode (if required)</label>
                  <input
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="123456"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Bot Features</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="recording"
                      checked={recording}
                      onChange={(e) => setRecording(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="recording" className="text-sm">Recording</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="transcription"
                      checked={transcription}
                      onChange={(e) => setTranscription(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="transcription" className="text-sm">Transcription</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="summary"
                      checked={summary}
                      onChange={(e) => setSummary(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="summary" className="text-sm">Summary & MoM</label>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={joinLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {joinLoading ? 'Joining...' : 'Join Meeting'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJoinForm(false)}
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
        ) : bots.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">No active bots</div>
            <button
              onClick={() => setShowJoinForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
            >
              Join Your First Meeting
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <div key={bot.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getPlatformIcon(bot.platform)}</span>
                    <span className="text-sm text-gray-500 capitalize">
                      {bot.platform.replace('-', ' ')}
                    </span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(bot.status)}`}>
                    {bot.status}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-2">
                  <div>Started: {new Date(bot.startTime).toLocaleString()}</div>
                  <div>Last Activity: {new Date(bot.lastActivity).toLocaleString()}</div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
                  {bot.recordingStarted && <span className="bg-red-100 text-red-800 px-2 py-1 rounded">🔴 Recording</span>}
                  {bot.transcript && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">📝 Transcript</span>}
                  {bot.mom && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">📋 MoM</span>}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEndBot(bot.id)}
                    disabled={bot.status === 'ending' || bot.status === 'failed'}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm font-medium disabled:opacity-50"
                  >
                    End Bot
                  </button>
                  <button
                    onClick={() => window.open(`/meetings/${bot.meetingId}`, '_blank')}
                    className="flex-1 border border-gray-300 text-gray-700 py-1 px-3 rounded text-sm font-medium hover:bg-gray-50"
                  >
                    View Meeting
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

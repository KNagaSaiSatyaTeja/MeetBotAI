'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'

export default function MeetingsPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!token) return
      setLoading(true)
      try {
        const res = await Api.listMeetings(token, { limit: 20 })
        setItems(res.items || res || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-4">Meetings</h1>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((m) => (
            <a key={m.id} href={`/meetings/${m.id}`} className="border rounded-lg p-4 hover:shadow">
              <div className="text-sm text-gray-500">{m.platform}</div>
              <div className="font-medium">{m.title}</div>
              <div className="text-xs text-gray-500">Status: {m.status}</div>
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}



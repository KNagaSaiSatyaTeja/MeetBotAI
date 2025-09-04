'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'

export default function MeetingDetailPage() {
  const params = useParams() as { id: string }
  const { token } = useAuth()
  const [m, setM] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!token || !params?.id) return
      try {
        const res = await Api.getMeeting(token, params.id)
        setM(res)
      } catch (e: any) {
        setError(e.message)
      }
    }
    load()
  }, [token, params?.id])

  return (
    <AppLayout>
      <div className="container py-6">
        {error && <div className="text-red-600 mb-3">{error}</div>}
        {!m && <div>Loading...</div>}
        {m && (
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold">{m.title}</h1>
            <div className="text-sm text-gray-500">{m.platform} • {m.status}</div>
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs">{JSON.stringify(m, null, 2)}</pre>
          </div>
        )}
      </div>
    </AppLayout>
  )
}



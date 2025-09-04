'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { API_BASE_URL } from '@/lib/api'

export default function AdminHealthPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`).then(r=>r.json()).then(setData).catch(() => {})
  }, [])

  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-6">System Health</h1>
        <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </AppLayout>
  )
}



'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/store/auth'
import { API_BASE_URL } from '@/lib/api'

export default function AdminHealthPage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (isAdmin()) {
      fetch(`${API_BASE_URL}/health`).then(r=>r.json()).then(setData).catch(() => {})
    }
  }, [isAdmin])

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
        <h1 className="text-2xl font-semibold mb-6">System Health</h1>
        <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </AppLayout>
  )
}



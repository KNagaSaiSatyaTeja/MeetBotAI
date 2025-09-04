'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'

export default function SearchPage() {
  const { token } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setLoading(true)
    try {
      const res = await Api.search(token, q)
      setResults(res.items || res || [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-4">Search Meetings</h1>
        <form onSubmit={onSearch} className="flex gap-2 mb-4">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search for keywords..." className="border rounded-md px-3 py-2 flex-1" />
          <button className="bg-blue-600 text-white rounded-md px-4">Search</button>
        </form>

        {loading && <div>Searching...</div>}
        <div className="space-y-3">
          {results.map((r, i) => (
            <a key={i} href={`/meetings/${r.id}`} className="block border rounded-md p-4 hover:shadow">
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-gray-500">{r.platform}</div>
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}



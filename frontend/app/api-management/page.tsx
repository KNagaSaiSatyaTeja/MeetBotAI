'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'

export default function ApiManagementPage() {
  const { token } = useAuth()
  const [keys, setKeys] = useState<any[]>([])
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!token) return
    try {
      const res = await Api.listApiKeys(token)
      setKeys(res)
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [token])

  async function createKey() {
    if (!token) return
    setLoading(true)
    try {
      const res = await Api.createApiKey(token, { label, scopes: ['meetings:read', 'meetings:write'] })
      alert(`New API key: ${res.key}`)
      setLabel('')
      await load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function revoke(id: string) {
    if (!token) return
    await Api.revokeApiKey(token, id)
    await load()
  }

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">API Key Management</h1>
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}

        <div className="border rounded-lg p-4 mb-6">
          <div className="flex gap-2">
            <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Key label" className="border rounded-md px-3 py-2 flex-1" />
            <button onClick={createKey} disabled={loading} className="bg-blue-600 text-white rounded-md px-4">{loading ? 'Creating...' : 'Generate Key'}</button>
          </div>
        </div>

        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="border rounded-md p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{k.label}</div>
                <div className="text-xs text-gray-500">Scopes: {k.scopes?.join(', ') || '-'}</div>
              </div>
              <button onClick={() => revoke(k.id)} className="text-red-600 text-sm">Revoke</button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}



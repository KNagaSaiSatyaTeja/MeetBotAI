'use client'

import { useAuth } from '@/store/auth'
import { useEffect, useState } from 'react'

export default function AuthTestPage() {
  const { user, token, _hasHydrated, fetchMe } = useAuth()
  const [localStorageData, setLocalStorageData] = useState<any>({})

  useEffect(() => {
    // Get all localStorage data
    const data: any = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || '{}')
        } catch {
          data[key] = localStorage.getItem(key)
        }
      }
    }
    setLocalStorageData(data)
  }, [])

  const handleFetchMe = async () => {
    try {
      await fetchMe()
    } catch (error) {
      console.error('fetchMe failed:', error)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Auth State */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Auth State</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Hydrated:</strong> {_hasHydrated ? '✅ Yes' : '❌ No'}</div>
            <div><strong>Token:</strong> {token ? `✅ ${token.substring(0, 20)}...` : '❌ None'}</div>
            <div><strong>User:</strong> {user ? `✅ ${user.email} (${user.role})` : '❌ None'}</div>
          </div>
          <button 
            onClick={handleFetchMe}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Fetch Me
          </button>
        </div>

        {/* LocalStorage Data */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">LocalStorage Data</h2>
          <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {Object.entries(localStorageData).map(([key, value]) => (
              <div key={key} className="border-b pb-2">
                <div><strong>{key}:</strong></div>
                <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                  {typeof value === 'string' ? value.substring(0, 100) + '...' : JSON.stringify(value, null, 2).substring(0, 200) + '...'}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Test */}
      <div className="mt-6 border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Navigation Test</h2>
        <div className="space-x-4">
          <a href="/" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Dashboard</a>
          <a href="/meetings" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Meetings</a>
          <a href="/bots" className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">Bots</a>
          <a href="/settings" className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Settings</a>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Api } from '@/lib/api'

export default function DebugPage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testApiConnection = async () => {
    setLoading(true)
    setResult('Testing API connection...\n')
    
    try {
      // Test 1: Check API_BASE_URL
      setResult(prev => prev + `API_BASE_URL: ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}\n`)
      
      // Test 1.5: Test simple fetch to see if it shows in Network tab
      setResult(prev => prev + 'Testing simple fetch...\n')
      try {
        const simpleResponse = await fetch('http://localhost:5000/v1/me')
        setResult(prev => prev + `Simple fetch status: ${simpleResponse.status}\n`)
      } catch (e: any) {
        setResult(prev => prev + `Simple fetch error: ${e.message}\n`)
      }
      
      // Test 2: Test login (only if not already authenticated)
      setResult(prev => prev + 'Testing login...\n')
      const loginResponse = await Api.login('test@example.com', 'password123')
      setResult(prev => prev + `Login successful: ${JSON.stringify(loginResponse, null, 2)}\n`)
      
      // Test 3: Test /me endpoint
      setResult(prev => prev + 'Testing /me endpoint...\n')
      const meResponse = await Api.me(loginResponse.token)
      setResult(prev => prev + `Me endpoint successful: ${JSON.stringify(meResponse, null, 2)}\n`)
      
      // Test 4: Test meetings endpoint
      setResult(prev => prev + 'Testing meetings endpoint...\n')
      const meetingsResponse = await Api.listMeetings(loginResponse.token, { limit: 5 })
      setResult(prev => prev + `Meetings endpoint successful: ${JSON.stringify(meetingsResponse, null, 2)}\n`)
      
      // Test 5: Test bots endpoint
      setResult(prev => prev + 'Testing bots endpoint...\n')
      const botsResponse = await Api.b2b.listBots(loginResponse.token)
      setResult(prev => prev + `Bots endpoint successful: ${JSON.stringify(botsResponse, null, 2)}\n`)
      
    } catch (error: any) {
      setResult(prev => prev + `Error: ${error.message}\n`)
      console.error('Debug test failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Debug Page</h1>
      <button 
        onClick={testApiConnection}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test API Connection'}
      </button>
      <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto max-h-96">
        {result}
      </pre>
    </div>
  )
}

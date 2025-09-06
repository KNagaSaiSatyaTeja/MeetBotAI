'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'

interface ApiToken {
  id: string
  label?: string
  status: string
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

export default function ApiManagementPage() {
  const { token } = useAuth()
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [newTokenResult, setNewTokenResult] = useState<{ token: string; id: string } | null>(null)

  // Form state
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!token) return

    const fetchTokens = async () => {
      try {
        setLoading(true)
        const data = await Api.listTokens(token)
        setApiTokens(data)
      } catch (e: any) {
        setError(e.message || 'Failed to load API tokens')
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
  }, [token])

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setCreateLoading(true)
    try {
      const result = await Api.createToken(token, { label })
      setNewTokenResult({ token: result.token, id: result.id })
      
      // Add to list
      setApiTokens([result, ...apiTokens])
      setLabel('')
      setShowCreateForm(false)
    } catch (e: any) {
      alert(e.message || 'Failed to create API token')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleRevokeToken = async (tokenId: string) => {
    if (!token || !confirm('Are you sure you want to revoke this API token? This action cannot be undone.')) return

    try {
      await Api.revokeToken(token, tokenId)
      setApiTokens(apiTokens.map(t => 
        t.id === tokenId ? { ...t, status: 'revoked' } : t
      ))
    } catch (e: any) {
      alert(e.message || 'Failed to revoke API token')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Token copied to clipboard!')
    })
  }

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">API Management</h1>
            <p className="text-gray-600 mt-1">Manage your API tokens for programmatic access</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Create Token
          </button>
        </div>

        {/* New Token Display */}
        {newTokenResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-green-800 mb-2">Token Created Successfully!</h3>
            <p className="text-sm text-green-700 mb-3">
              Copy this token now - you won't be able to see it again!
            </p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-white border rounded px-3 py-2 text-sm font-mono break-all">
                {newTokenResult.token}
              </code>
              <button
                onClick={() => copyToClipboard(newTokenResult.token)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setNewTokenResult(null)}
              className="mt-3 text-sm text-green-600 hover:text-green-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create Token Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Create API Token</h2>
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Token Label</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="My Integration Token"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose a descriptive name to identify this token
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {createLoading ? 'Creating...' : 'Create Token'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
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

        <div className="border rounded-lg">
          <div className="p-4 border-b bg-gray-50">
            <div className="font-medium">Your API Tokens ({apiTokens.length})</div>
          </div>
          
          {loading ? (
            <div className="p-4">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                    <div className="w-20 h-6 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : apiTokens.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-lg mb-2">No API tokens yet</div>
              <p className="text-sm mb-4">Create your first API token to start integrating with our API</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Create Token
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {apiTokens.map((apiToken) => (
                <div key={apiToken.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {apiToken.label || 'Unnamed Token'}
                    </div>
                    <div className="text-sm text-gray-600">
                      Created {new Date(apiToken.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {apiToken.lastUsedAt 
                        ? `Last used ${new Date(apiToken.lastUsedAt).toLocaleDateString()}`
                        : 'Never used'
                      }
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      apiToken.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {apiToken.status}
                    </span>
                    
                    {apiToken.status === 'active' && (
                      <button
                        onClick={() => handleRevokeToken(apiToken.id)}
                        className="px-3 py-1 text-xs rounded-md font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">Using Your API Token</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>Include your API token in the request header:</p>
            <code className="block bg-white border rounded px-3 py-2 text-xs font-mono">
              X-API-Key: mbt_your_token_here
            </code>
            <p className="text-xs">
              API Base URL: <code className="bg-white px-1 rounded">https://api.meetbotai.com/v1</code>
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-medium text-yellow-800 mb-2">Security Notes</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Keep your API tokens secure and never share them publicly</li>
            <li>• Tokens are only shown once during creation</li>
            <li>• Revoked tokens cannot be restored - create a new one if needed</li>
            <li>• Monitor token usage and revoke unused tokens</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  )
}
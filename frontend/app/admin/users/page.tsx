'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/store/auth'
import { Api } from '@/lib/api'

interface User {
  id: string
  email: string
  name?: string
  companyName?: string
  role: string
  provider: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminUsersPage() {
  const { token, isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !isAdmin()) return

    const fetchUsers = async () => {
      try {
        setLoading(true)
        const data = await Api.admin.listUsers(token)
        setUsers(data)
      } catch (e: any) {
        setError(e.message || 'Failed to load users')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [token, isAdmin])

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!token) return

    try {
      setUpdatingUser(userId)
      await Api.admin.updateUserStatus(token, userId, !currentStatus)
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, isActive: !currentStatus }
          : user
      ))
    } catch (e: any) {
      alert(e.message || 'Failed to update user status')
    } finally {
      setUpdatingUser(null)
    }
  }

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
        <h1 className="text-2xl font-semibold mb-6">User Management</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="border rounded-lg">
          <div className="p-4 border-b bg-gray-50">
            <div className="font-medium">All Users ({users.length})</div>
          </div>
          
          {loading ? (
            <div className="p-4">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                    <div className="w-20 h-6 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No users found
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      user.role === 'ADMIN' ? 'bg-purple-500' : 'bg-blue-500'
                    }`}>
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.name || 'Unnamed User'}
                        {user.role === 'ADMIN' && (
                          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      {user.companyName && (
                        <div className="text-xs text-gray-500">{user.companyName}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        Joined {new Date(user.createdAt).toLocaleDateString()} • {user.provider}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                    
                    <button
                      onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                      disabled={updatingUser === user.id}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-colors disabled:opacity-50 ${
                        user.isActive
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {updatingUser === user.id ? 'Updating...' : user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-medium text-yellow-800 mb-2">User Management Notes</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Deactivated users cannot log in or use API tokens</li>
            <li>• Admin users have full system access and cannot deactivate themselves</li>
            <li>• User data is retained when deactivated for compliance</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  )
}
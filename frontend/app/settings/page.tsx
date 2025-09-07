'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/store/auth'
import { useState } from 'react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    avatarUrl: user?.avatarUrl || ''
  })

  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Section */}
          <div className="lg:col-span-1">
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Profile</h2>
              <div className="flex flex-col items-center space-y-4">
                <Avatar user={user} size="lg" />
                <div className="text-center">
                  <p className="font-medium">{user?.email || 'Guest'}</p>
                  <p className="text-sm text-gray-500">{user?.role || 'User'}</p>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-800">
                  Change Avatar
                </button>
              </div>
            </div>
          </div>

          {/* Settings Sections */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border rounded-lg p-4">
              <div className="font-medium mb-2">Integrations</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>Google Calendar</div>
                  <button className="border rounded-md px-3 py-1">Connect</button>
                </div>
                <div className="flex items-center justify-between">
                  <div>Outlook Calendar</div>
                  <button className="border rounded-md px-3 py-1">Connect</button>
                </div>
                <div className="flex items-center justify-between">
                  <div>Slack</div>
                  <button className="border rounded-md px-3 py-1">Connect</button>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="font-medium mb-2">Notification Settings</div>
              <div className="space-y-3">
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Send MoM via Email</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Send MoM to Slack Channel</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Push via Webhook</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}



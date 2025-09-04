'use client'

import { AppLayout } from '@/components/layout/app-layout'

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </AppLayout>
  )
}



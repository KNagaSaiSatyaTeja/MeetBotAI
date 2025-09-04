'use client'

import { AppLayout } from '@/components/layout/app-layout'

export default function AdminDashboardPage() {
  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <div className="font-medium mb-2">Overview Metrics</div>
            <div className="h-56 bg-gray-50 rounded" />
          </div>
          <div className="border rounded-lg p-4">
            <div className="font-medium mb-2">System Health</div>
            <div className="h-56 bg-gray-50 rounded" />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}



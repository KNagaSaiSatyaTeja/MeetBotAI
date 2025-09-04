'use client'

import { AppLayout } from '@/components/layout/app-layout'

export default function AdminUsersPage() {
  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-semibold mb-6">User Management</h1>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Coming soon: list users, roles, status, last login</div>
        </div>
      </div>
    </AppLayout>
  )
}



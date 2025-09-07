'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/store/auth'

export default function AdminBillingPage() {
  const { isAdmin } = useAuth()

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
        <h1 className="text-2xl font-semibold mb-6">Billing & Subscriptions</h1>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Coming soon: plans, invoices, transactions, Stripe integration</div>
        </div>
      </div>
    </AppLayout>
  )
}



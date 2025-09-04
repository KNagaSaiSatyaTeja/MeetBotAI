'use client'

import { AppLayout } from '@/components/layout/app-layout'

export default function AdminBillingPage() {
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



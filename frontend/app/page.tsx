'use client'

import { Suspense } from 'react'
import { Dashboard } from '@/components/dashboard/dashboard'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { AppLayout } from '@/components/layout/app-layout'

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="container py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your meetings, transcriptions, and analytics.
          </p>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
    </AppLayout>
  )
}

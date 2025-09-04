export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
              <div className="h-8 w-16 bg-muted animate-pulse rounded"></div>
              <div className="h-3 w-32 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Meetings Skeleton */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
          <div className="h-4 w-64 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="p-6 pt-0">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-muted animate-pulse rounded"></div>
                  <div className="h-3 w-32 bg-muted animate-pulse rounded"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-16 bg-muted animate-pulse rounded-full"></div>
                  <div className="h-4 w-12 bg-muted animate-pulse rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


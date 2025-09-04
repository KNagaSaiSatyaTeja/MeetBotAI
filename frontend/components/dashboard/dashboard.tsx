'use client'

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Meetings</h3>
          </div>
          <div className="text-2xl font-bold">1,245</div>
          <p className="text-xs text-muted-foreground">+18% from last month</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Processed</h3>
          </div>
          <div className="text-2xl font-bold">9,876</div>
          <p className="text-xs text-muted-foreground">2.5M minutes transcribed</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Avg Turnaround</h3>
          </div>
          <div className="text-2xl font-bold">2.5h</div>
          <p className="text-xs text-muted-foreground">Target: 3h remaining</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Storage Used</h3>
          </div>
          <div className="text-2xl font-bold">850 GB</div>
          <p className="text-xs text-muted-foreground">75% of total capacity</p>
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">Recent Meetings</h3>
          <p className="text-sm text-muted-foreground">Latest meeting recordings and transcriptions</p>
        </div>
        <div className="p-6 pt-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Q3 Planning Session</p>
                <p className="text-sm text-muted-foreground">Oct 26, 2023 • Zoom • 45m</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  Ready
                </span>
                <button className="text-sm text-blue-600 hover:text-blue-800">View</button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Marketing Campaign Brainstorm</p>
                <p className="text-sm text-muted-foreground">Oct 25, 2023 • Google Meet • 30m</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                  Processing
                </span>
                <button className="text-sm text-blue-600 hover:text-blue-800">View</button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Client Update Call</p>
                <p className="text-sm text-muted-foreground">Oct 24, 2023 • Teams • 1h</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  Ready
                </span>
                <button className="text-sm text-blue-600 hover:text-blue-800">View</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


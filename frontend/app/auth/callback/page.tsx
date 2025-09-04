'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Api } from '@/lib/api'
import { useAuth } from '@/store/auth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        setError(error?.message || 'No Supabase session found')
        return
      }
      try {
        const res = await Api.exchangeSupabaseToken(data.session.access_token)
        ;(useAuth as any).setState({ token: (res as any).token, user: (res as any).user })
        router.replace('/')
      } catch (e: any) {
        setError(e.message)
      }
    }
    run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? <div className="text-red-600">{error}</div> : <div>Signing you in...</div>}
    </div>
  )
}



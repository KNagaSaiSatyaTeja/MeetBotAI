'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Api } from '@/lib/api'
import { useAuth } from '@/store/auth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { exchangeSupabaseToken } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        setError(error?.message || 'No Supabase session found')
        return
      }
      try {
        await exchangeSupabaseToken(data.session.access_token)
        router.replace('/')
      } catch (e: any) {
        setError(e.message)
      }
    }
    run()
  }, [router, exchangeSupabaseToken])

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? <div className="text-red-600">{error}</div> : <div>Signing you in...</div>}
    </div>
  )
}



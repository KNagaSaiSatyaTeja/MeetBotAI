'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const { register: registerUser, loading, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await registerUser(email, password, name, companyName)
    router.replace('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-10 w-10 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">AI</div>
          <h1 className="mt-3 text-2xl font-semibold">Create your account</h1>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input 
              value={name} 
              onChange={e=>setName(e.target.value)} 
              required 
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
              placeholder="John Doe" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input 
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              type="email" 
              required 
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
              placeholder="you@example.com" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name (Optional)</label>
            <input 
              value={companyName} 
              onChange={e=>setCompanyName(e.target.value)} 
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
              placeholder="Acme Inc" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              type="password" 
              required 
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
              placeholder="••••••••" 
            />
          </div>
          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium disabled:opacity-60 transition-colors">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="my-4 flex items-center"><div className="flex-1 h-px bg-gray-200"/><span className="px-2 text-xs text-gray-500">OR CONTINUE WITH</span><div className="flex-1 h-px bg-gray-200"/></div>

        <button type="button" onClick={async ()=>{
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
            },
          })
          if (error) alert(error.message)
        }} className="w-full border rounded-md py-2 font-medium flex items-center justify-center gap-2">
          <span>🔵</span>
          <span>Google</span>
        </button>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}



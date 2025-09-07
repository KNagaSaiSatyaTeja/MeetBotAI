'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Api } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
  role: string
  name?: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  loading: boolean
  error: string | null
  _hasHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, companyName?: string) => Promise<void>
  exchangeSupabaseToken: (accessToken: string) => Promise<void>
  fetchMe: () => Promise<void>
  logout: () => void
  isAdmin: () => boolean
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      error: null,
      _hasHydrated: false,

      async login(email, password) {
        set({ loading: true, error: null })
        try {
          const res = await Api.login({ email, password })
          set({ token: res.token, user: res.user, loading: false })
        } catch (e: any) {
          set({ error: e.message || 'Login failed', loading: false })
          throw e
        }
      },

      async register(email, password, name, companyName) {
        set({ loading: true, error: null })
        try {
          await Api.register({ email, password, name, companyName })
          // auto-login after register
          const res = await Api.login({ email, password })
          set({ token: res.token, user: res.user, loading: false })
        } catch (e: any) {
          set({ error: e.message || 'Registration failed', loading: false })
          throw e
        }
      },

      async exchangeSupabaseToken(accessToken) {
        set({ loading: true, error: null })
        try {
          const res = await Api.exchangeSupabaseToken(accessToken)
          set({ token: res.token, user: res.user, loading: false })
        } catch (e: any) {
          set({ error: e.message || 'Token exchange failed', loading: false })
          throw e
        }
      },

      async fetchMe() {
        const token = get().token
        console.log('🔍 fetchMe called, token available:', !!token)
        if (!token) {
          console.log('❌ No token available for fetchMe')
          return
        }
        try {
          console.log('📡 Calling Api.me with token...')
          const me = await Api.me(token)
          console.log('✅ fetchMe successful, user:', me)
          set({ user: me as any })
        } catch (e) {
          console.error('❌ fetchMe failed:', e)
          // Don't auto-logout on network errors, only on auth errors
          if (e instanceof Error && e.message.includes('401')) {
            console.log('🔒 401 error - logging out user')
            set({ token: null, user: null })
          } else {
            console.log('🌐 Network error - keeping user logged in')
          }
        }
      },

      logout() {
        set({ token: null, user: null })
      },

      isAdmin() {
        const user = get().user
        return user?.role === 'ADMIN'
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        _hasHydrated: false // Don't persist hydration state
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('🔄 Auth store rehydrated:', state)
          state._hasHydrated = true
        }
      }
    }
  )
)



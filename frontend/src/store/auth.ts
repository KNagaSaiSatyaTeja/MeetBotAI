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
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, companyName?: string) => Promise<void>
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

      async fetchMe() {
        const token = get().token
        if (!token) return
        try {
          const me = await Api.me(token)
          set({ user: me as any })
        } catch (e) {
          // token invalid -> logout
          set({ token: null, user: null })
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
    { name: 'auth-store' }
  )
)



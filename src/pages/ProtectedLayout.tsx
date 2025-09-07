import { useEffect, useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function ProtectedLayout(){
  const { userEmail, accessToken, setAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    async function boot(){
      if (!isSupabaseConfigured) { setLoading(false); return }
      try {
        const { data } = await supabase.auth.getSession()
        if (!cancelled){
          const email = data.session?.user?.email ?? localStorage.getItem('user_email')
          const token = data.session?.access_token ?? localStorage.getItem('access_token')
          setAuth(token ?? null, email ?? null)
        }
      } finally { if (!cancelled) setLoading(false) }
    }
    boot()
    return () => { cancelled = true }
  }, [setAuth])

  if (loading) return <div className="p-6">Loading...</div>
  if (!userEmail && !accessToken) return <Navigate to="/auth/login" replace state={{ from: location }} />
  return <Outlet />
}

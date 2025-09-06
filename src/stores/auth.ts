import { create } from 'zustand'

type AuthState = {
  accessToken: string | null
  userEmail: string | null
  setAuth: (token: string | null, email: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userEmail: null,
  setAuth: (token, email) => set({ accessToken: token, userEmail: email }),
}))

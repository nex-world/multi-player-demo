import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router'
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from "@/shadcn/components/theme-provider.tsx"
// import { DevPage } from './pages/DevPage.tsx'
import { ConnectRoom } from './pages/ConnectRoom.tsx'
import { AuthError } from './pages/AuthError.tsx'
import { AuthLayout } from './pages/auth/AuthLayout.tsx'
import { AuthLogin } from './pages/auth/Login.tsx'
import { AuthConfirm } from './pages/auth/Confirm.tsx'
import { AuthForgotPassword } from './pages/auth/ForgotPassword.tsx'
import { AuthSignUp } from './pages/auth/SignUp.tsx'
import { AuthSignUpSuccess } from './pages/auth/SignUpSuccess.tsx'
import { AuthUpdatePassword } from './pages/auth/UpdatePassword.tsx'
import { ProtectedLayout } from './pages/ProtectedLayout.tsx'
import { DevPage } from './pages/DevPage.tsx'
import { StartPage } from './pages/Start.tsx'

// Before React mounts: if URL has error params from Supabase (without hash), redirect to hash route
(() => {
  try {
    const url = new URL(window.location.href)
    const hasError = url.searchParams.get('error') || url.searchParams.get('error_description')
    const hasCode = url.searchParams.get('code')
    if (hasError && !hasCode && !url.hash.startsWith('#/auth/error')) {
      const dest = `${url.origin}${url.pathname}#/auth/error${url.search}`
      window.location.replace(dest)
    }
  } catch {}
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/start" element={<StartPage />} />
          {/* Back-compat: redirect old /room to /connect-room */}
          <Route path="/room" element={<Navigate to="/connect-room" replace />} />
          <Route path="/connect-room" element={<ConnectRoom />} />
          {/* Auth routes */}
          <Route path="/auth" element={<AuthLayout /> }>
            <Route index element={<Navigate to="login" replace />} />
            <Route path="login" element={<AuthLogin />} />
            <Route path="confirm" element={<AuthConfirm />} />
            <Route path="error" element={<AuthError />} />
            <Route path="forgot-password" element={<AuthForgotPassword />} />
            <Route path="sign-up" element={<AuthSignUp />} />
            <Route path="sign-up-success" element={<AuthSignUpSuccess />} />
            <Route path="update-password" element={<AuthUpdatePassword />} />
          </Route>
          {/* Protected routes */}
          <Route path="/protected" element={<ProtectedLayout /> }>
            <Route path="dev" element={<DevPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>,
)

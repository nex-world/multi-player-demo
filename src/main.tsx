import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router'
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from "@/shadcn/components/theme-provider.tsx"
// import { DevPage } from './pages/DevPage.tsx'
import { ConnectRoom } from './pages/ConnectRoom.tsx'
import { AuthError } from './pages/AuthError.tsx'

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
          {/* <Route path="/dev" element={<DevPage />} /> */}
          <Route path="/room" element={<ConnectRoom />} />
          <Route path="/auth/error" element={<AuthError />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>,
)

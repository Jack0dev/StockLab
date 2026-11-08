import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/infrastructure/context/AuthContext'
import { QuickTradeProvider } from '@/infrastructure/context/QuickTradeContext'
import ProtectedRoute from '@/presentation/components/ProtectedRoute'
import AdminRoute from '@/presentation/components/AdminRoute'
import Navbar from '@/presentation/components/Navbar'
import TourOverlay from '@/presentation/components/TourOverlay'
import AIChatWidget from '@/presentation/components/AIChatWidget'
import QuickTradingDock from '@/presentation/components/QuickTradingDock'

// Route modules — mỗi module quản lý route riêng
import publicRoutes from '@/presentation/routes/PublicRoutes'
import protectedRoutes from '@/presentation/routes/ProtectedRoutes'
import adminRoutes from '@/presentation/routes/AdminRoutes'

// Layout chính (có Navbar) cho các trang sau khi đăng nhập
function AppLayout() {
  const { user } = useAuth()
  return (
    <>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <TourOverlay />
      <AIChatWidget />
      {user?.role !== 'ADMIN' && <QuickTradingDock />}
    </>
  )
}

function App() {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <QuickTradeProvider>
      <Routes>
        {/* Public routes */}
        {publicRoutes.map(({ path, page: Page }) => (
          <Route key={path} path={path} element={isAuthenticated ? <Navigate to={user?.role === 'ADMIN' ? '/admin/stocks' : '/stocks'} /> : <Page />} />
        ))}

        {/* Protected routes */}
        <Route element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          {protectedRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute />}>
          <Route element={<AppLayout />}>
            {adminRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to={isAuthenticated ? (user?.role === 'ADMIN' ? '/admin/stocks' : '/stocks') : '/login'} />} />
      </Routes>
    </QuickTradeProvider>
  )
}

export default App

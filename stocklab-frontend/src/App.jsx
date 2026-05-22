import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Navbar from './components/Navbar'
import TourOverlay from './components/TourOverlay'
import AIChatWidget from './components/AIChatWidget'

// Route modules — mỗi module quản lý route riêng, tránh conflict
import publicRoutes from './routes/PublicRoutes'
import protectedRoutes from './routes/ProtectedRoutes'
import adminRoutes from './routes/AdminRoutes'

// Layout chính (có Navbar) cho các trang sau khi đăng nhập
function AppLayout() {
  return (
    <>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <TourOverlay />
      <AIChatWidget />
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
  )
}

export default App

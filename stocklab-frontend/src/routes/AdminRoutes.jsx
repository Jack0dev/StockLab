import AdminDashboardPage from '../pages/AdminDashboardPage'
import AdminUsersPage from '../pages/AdminUsersPage'
import AdminStocksPage from '../pages/AdminStocksPage'
import AdminOrdersPage from '../pages/AdminOrdersPage'
import BotActivityPage from '../pages/BotActivityPage'
import PlatformTokenPage from '../pages/PlatformTokenPage'

const adminRoutes = [
  { path: '/admin/dashboard', element: <AdminDashboardPage /> },
  { path: '/admin/users', element: <AdminUsersPage /> },
  { path: '/admin/stocks', element: <AdminStocksPage /> },
  { path: '/admin/orders', element: <AdminOrdersPage /> },
  { path: '/admin/bot-activity', element: <BotActivityPage /> },
  { path: '/admin/platform-token', element: <PlatformTokenPage /> },
]

export default adminRoutes

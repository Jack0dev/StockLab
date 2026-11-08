import AdminDashboardPage from '@/presentation/pages/AdminDashboardPage'
import AdminUsersPage from '@/presentation/pages/AdminUsersPage'
import AdminStocksPage from '@/presentation/pages/AdminStocksPage'
import AdminOrdersPage from '@/presentation/pages/AdminOrdersPage'
import BotActivityPage from '@/presentation/pages/BotActivityPage'
import PlatformTokenPage from '@/presentation/pages/PlatformTokenPage'
import AdminNewsPage from '@/presentation/pages/AdminNewsPage'
import StockDetailPage from '@/presentation/pages/StockDetailPage'

const adminRoutes = [
  { path: '/admin/dashboard', element: <AdminDashboardPage /> },
  { path: '/admin/news', element: <AdminNewsPage /> },
  { path: '/admin/users', element: <AdminUsersPage /> },
  { path: '/admin/stocks', element: <AdminStocksPage /> },
  { path: '/admin/stocks/:ticker', element: <StockDetailPage /> },
  { path: '/admin/orders', element: <AdminOrdersPage /> },
  { path: '/admin/manipulation', element: <BotActivityPage defaultTab="manipulation" /> },
  { path: '/admin/scenarios', element: <BotActivityPage defaultTab="manipulation" /> },
  { path: '/admin/bot-activity', element: <BotActivityPage defaultTab="overview" /> },
  { path: '/admin/platform-token', element: <PlatformTokenPage /> },
]

export default adminRoutes

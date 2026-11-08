import ProfilePage from '@/presentation/pages/ProfilePage'
import StockListPage from '@/presentation/pages/StockListPage'
import StockDetailPage from '@/presentation/pages/StockDetailPage'
import NewsPage from '@/presentation/pages/NewsPage'
import TradingPage from '@/presentation/pages/TradingPage'
import TransactionHistoryPage from '@/presentation/pages/TransactionHistoryPage'
import PortfolioPage from '@/presentation/pages/PortfolioPage'
import WatchlistPage from '@/presentation/pages/WatchlistPage'
import OrderHistoryPage from '@/presentation/pages/OrderHistoryPage'
import OrderBookPage from '@/presentation/pages/OrderBookPage'
import ConditionalOrderPage from '@/presentation/pages/ConditionalOrderPage'
import WalletPage from '@/presentation/pages/WalletPage'
import ReportPage from '@/presentation/pages/ReportPage'
import VnPayResultPage from '@/presentation/pages/VnPayResultPage'

const protectedRoutes = [
  { path: '/profile', element: <ProfilePage /> },
  { path: '/stocks', element: <StockListPage /> },
  { path: '/stocks/:ticker', element: <StockDetailPage /> },
  { path: '/news', element: <NewsPage /> },
  { path: '/trading', element: <TradingPage /> },
  { path: '/conditional-order', element: <ConditionalOrderPage /> },
  { path: '/transactions', element: <TransactionHistoryPage /> },
  { path: '/portfolio', element: <PortfolioPage /> },
  { path: '/watchlist', element: <WatchlistPage /> },
  { path: '/orders', element: <OrderHistoryPage /> },
  { path: '/order-book', element: <OrderBookPage /> },
  { path: '/wallet', element: <WalletPage /> },
  { path: '/payment-result', element: <VnPayResultPage /> },
  { path: '/reports', element: <ReportPage /> },
]

export default protectedRoutes

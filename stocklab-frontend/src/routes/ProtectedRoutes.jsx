import ProfilePage from '../pages/ProfilePage'
import StockListPage from '../pages/StockListPage'
import StockDetailPage from '../pages/StockDetailPage'
import TradingPage from '../pages/TradingPage'
import TransactionHistoryPage from '../pages/TransactionHistoryPage'
import PortfolioPage from '../pages/PortfolioPage'
import WatchlistPage from '../pages/WatchlistPage'
import OrderHistoryPage from '../pages/OrderHistoryPage'
import OrderBookPage from '../pages/OrderBookPage'
import ConditionalOrderPage from '../pages/ConditionalOrderPage'
import WalletPage from '../pages/WalletPage'
import ReportPage from '../pages/ReportPage'
import VnPayResultPage from '../pages/VnPayResultPage'

const protectedRoutes = [
  { path: '/profile', element: <ProfilePage /> },
  { path: '/stocks', element: <StockListPage /> },
  { path: '/stocks/:ticker', element: <StockDetailPage /> },
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

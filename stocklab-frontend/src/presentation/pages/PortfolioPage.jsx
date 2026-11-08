import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { useQuickTrade } from '@/infrastructure/context/QuickTradeContext';
import { useWebSocket } from '@/infrastructure/context/WebSocketContext';
import { usePortfolioData } from '@/presentation/controllers/usePortfolioData';
import { usePortfolioModal } from '@/presentation/controllers/usePortfolioModal';
import PortfolioCustomTabs from '@/presentation/components/portfolio/PortfolioCustomTabs';
import PortfolioSummaryCards from '@/presentation/components/portfolio/PortfolioSummaryCards';
import PortfolioDonutChart from '@/presentation/components/portfolio/PortfolioDonutChart';
import PortfolioHoldingsTable from '@/presentation/components/portfolio/PortfolioHoldingsTable';
import PortfolioManageModal from '@/presentation/components/portfolio/PortfolioManageModal';
import './PortfolioPage.css';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PortfolioPage() {
  const { restartTour } = usePageTour('portfolio');
  const { lastResyncTime } = useWebSocket();
  const { openTrade } = useQuickTrade();

  // 1. Data Hook: Fetch danh mục gốc + danh mục tùy chỉnh, đồng bộ WebSocket
  const {
    portfolio,
    balance,
    loading,
    customPortfolios,
    activeTab,
    setActiveTab,
    activeCustom,
    isAll,
    baseMetrics,
    currentHoldings,
    currentTotalValue,
    currentTotalInvested,
    currentTotalPnL,
    currentTotalPnLPercent,
    currentAllocations,
    refreshCustomPortfolios,
    fetchCustomSummary,
  } = usePortfolioData({ lastResyncTime });

  // 2. Modal Hook: Quản lý đóng/mở/submit modal CRUD danh mục tùy chỉnh
  const modalProps = usePortfolioModal({
    refreshCustomPortfolios,
    setActiveTab,
    activeTab,
    fetchCustomSummary,
  });

  if (loading) {
    return (
      <div className="portfolio-editorial-page">
        <div className="pf-loading-box">
          <div className="spinner"></div>
          <span>Đang đồng bộ danh mục tài sản...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-editorial-page fade-in">
      {/* Top Header */}
      <div className="pf-top-header">
        <div>
          <span className="pf-page-tag">QUẢN TRỊ NGUỒN VỐN</span>
          <h1 className="pf-page-title">Danh Mục Đầu Tư & Phân Bổ Tài Sản</h1>
          <p className="pf-page-sub">
            Theo dõi hiệu suất sinh lời, cơ cấu tài sản và quản lý các danh mục chiến lược riêng biệt
          </p>
        </div>
        <div className="pf-header-actions">
          <button className="help-text-btn" onClick={restartTour} title="Hướng dẫn sử dụng">
            Trợ giúp
          </button>
        </div>
      </div>

      {/* 1. Horizontal Navigation Tabs */}
      <PortfolioCustomTabs
        isAll={isAll}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        customPortfolios={customPortfolios}
        portfolioLength={portfolio.length}
        openEditModal={modalProps.openEditModal}
        openCreateModal={modalProps.openCreateModal}
      />

      {/* 2. Strategy Banner & 4 Summary Metrics Cards */}
      <PortfolioSummaryCards
        isAll={isAll}
        activeCustom={activeCustom}
        portfolioLength={portfolio.length}
        currentHoldings={currentHoldings}
        currentTotalValue={currentTotalValue}
        currentTotalInvested={currentTotalInvested}
        currentTotalPnL={currentTotalPnL}
        currentTotalPnLPercent={currentTotalPnLPercent}
        totalAssets={baseMetrics.totalAssets}
        totalValue={baseMetrics.totalValue}
        balance={balance}
        openEditModal={modalProps.openEditModal}
        openDeleteModal={modalProps.openDeleteModal}
      />

      {/* 3. Donut Allocation Chart & Stock Breakdown */}
      <PortfolioDonutChart
        isAll={isAll}
        activeCustom={activeCustom}
        currentAllocations={currentAllocations}
      />

      {/* 4. Holdings Data Table with Sell Actions */}
      <PortfolioHoldingsTable
        isAll={isAll}
        activeCustom={activeCustom}
        currentHoldings={currentHoldings}
        openEditModal={modalProps.openEditModal}
        openTrade={openTrade}
      />

      {/* 5. Modals for Custom Portfolio Management */}
      <PortfolioManageModal
        {...modalProps}
        portfolio={portfolio}
      />
    </div>
  );
}

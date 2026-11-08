import { formatPrice } from '@/service/portfolio.service';

export default function PortfolioSummaryCards({
  isAll,
  activeCustom,
  portfolioLength = 0,
  currentHoldings = [],
  currentTotalValue = 0,
  currentTotalInvested = 0,
  currentTotalPnL = 0,
  currentTotalPnLPercent = 0,
  totalAssets = 0,
  totalValue = 0,
  balance = 0,
  openEditModal,
  openDeleteModal,
}) {
  return (
    <>
      {/* Strategy Banner for Custom Portfolio */}
      {!isAll && activeCustom && (
        <div className="pf-custom-meta-banner">
          <div className="pf-custom-meta-left">
            <div className="pf-custom-meta-title-row">
              <span className="pf-custom-meta-badge">Danh mục chiến lược</span>
              <h3 className="pf-custom-meta-title">{activeCustom.name}</h3>
            </div>
            <p className="pf-custom-desc">
              {activeCustom.description ||
                'Chưa có mô tả cho danh mục chiến lược này. Bấm "Chỉnh Sửa" để bổ sung ghi chú.'}
            </p>
          </div>
          <div className="pf-custom-meta-actions">
            <button
              className="pf-banner-btn pf-banner-btn-edit"
              onClick={() => openEditModal(activeCustom)}
            >
              ✏️ Chỉnh Sửa Danh Mục
            </button>
            <button
              className="pf-banner-btn pf-banner-btn-delete"
              onClick={() => openDeleteModal(activeCustom)}
              title="Xóa danh mục này"
            >
              🗑️ Xóa
            </button>
          </div>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="pf-editorial-summary-grid">
        <div className="pf-summary-card">
          <div className="pf-summary-header">
            <span className="pf-summary-idx mono-num">01</span>
            <span className="pf-summary-label">
              {isAll ? 'Tổng Tài Sản (NAV)' : 'Giá Trị Danh Mục'}
            </span>
          </div>
          <div className="pf-summary-value tabular-num">
            {formatPrice(isAll ? totalAssets : currentTotalValue)}{' '}
            <span className="pf-curr">₫</span>
          </div>
          <span className="pf-summary-sub">
            {isAll
              ? 'Bao gồm cổ phiếu + tiền mặt'
              : `Thị giá hiện tại của ${currentHoldings.length} mã`}
          </span>
        </div>

        <div className="pf-summary-card">
          <div className="pf-summary-header">
            <span className="pf-summary-idx mono-num">02</span>
            <span className="pf-summary-label">
              {isAll ? 'Giá Trị Cổ Phiếu' : 'Vốn Đầu Tư Gốc'}
            </span>
          </div>
          <div className="pf-summary-value tabular-num">
            {formatPrice(isAll ? totalValue : currentTotalInvested)}{' '}
            <span className="pf-curr">₫</span>
          </div>
          <span className="pf-summary-sub">
            {isAll ? `${portfolioLength} mã đang nắm giữ` : 'Tổng giá vốn mua vào'}
          </span>
        </div>

        <div className="pf-summary-card">
          <div className="pf-summary-header">
            <span className="pf-summary-idx mono-num">03</span>
            <span className="pf-summary-label">
              {isAll ? 'Tiền Mặt Khả Dụng' : 'Tỷ Trọng / Tổng NAV'}
            </span>
          </div>
          <div className="pf-summary-value tabular-num">
            {isAll ? (
              <>
                {formatPrice(balance)} <span className="pf-curr">₫</span>
              </>
            ) : (
              <>
                {Number(totalAssets) > 0
                  ? ((Number(currentTotalValue) / Number(totalAssets)) * 100).toFixed(1)
                  : '0.0'}
                %
              </>
            )}
          </div>
          <span className="pf-summary-sub">
            {isAll ? 'Sẵn sàng để đặt lệnh' : 'Tỷ lệ so với toàn bộ tài sản'}
          </span>
        </div>

        <div className="pf-summary-card">
          <div className="pf-summary-header">
            <span className="pf-summary-idx mono-num">04</span>
            <span className="pf-summary-label">Tổng Lãi / Lỗ</span>
          </div>
          <div
            className={`pf-summary-value tabular-num ${
              (Number(currentTotalPnL) || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            }`}
          >
            {(Number(currentTotalPnL) || 0) >= 0 ? '+' : ''}
            {formatPrice(currentTotalPnL)} <span className="pf-curr">₫</span>
          </div>
          <span
            className={`pf-pnl-pct mono-num ${
              (Number(currentTotalPnL) || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            }`}
          >
            {(Number(currentTotalPnLPercent) || 0) >= 0 ? '↑ +' : '↓ '}
            {(Number(currentTotalPnLPercent) || 0).toFixed(2)}% so với vốn
          </span>
        </div>
      </div>
    </>
  );
}

import { formatPrice } from '@/service/portfolio.service';

export default function PortfolioHoldingsTable({
  isAll,
  activeCustom,
  currentHoldings = [],
  openEditModal,
  openTrade,
}) {
  if (currentHoldings.length === 0) {
    return (
      <div className="pf-empty-card">
        <span className="pf-empty-icon">📁</span>
        <h3 className="pf-empty-title">
          {isAll
            ? 'Danh mục hiện đang trống'
            : `Danh mục "${activeCustom?.name}" chưa có cổ phiếu`}
        </h3>
        <p className="pf-empty-desc">
          {isAll
            ? 'Tài khoản hiện chưa sở hữu mã cổ phiếu nào. Hãy chuyển tới sàn giao dịch để bắt đầu đầu tư.'
            : 'Hãy thêm các mã cổ phiếu đang sở hữu vào danh mục này để theo dõi riêng biệt.'}
        </p>
        {isAll ? (
          <button className="btn btn-primary" onClick={() => openTrade({ side: 'BUY' })}>
            Bắt Đầu Đặt Lệnh Mua →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => openEditModal(activeCustom)}>
            ✏️ Cấu Hình / Thêm Cổ Phiếu Vào Danh Mục
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pf-table-surface">
      <div className="pf-table-heading">
        <h3 className="pf-table-title">
          {isAll
            ? 'Chi Tiết Cổ Phiếu Nắm Giữ'
            : `Chi Tiết Cổ Phiếu Danh Mục: ${activeCustom?.name}`}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="pf-table-count">
            <strong className="mono-num">{currentHoldings.length}</strong> vị thế
          </span>
          {!isAll && (
            <button
              className="pf-banner-btn pf-banner-btn-edit"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              onClick={() => openEditModal(activeCustom)}
            >
              ✏️ Chỉnh Sửa Danh Mục
            </button>
          )}
        </div>
      </div>

      <div className="pf-table-scroll">
        <table className="pf-editorial-table">
          <thead>
            <tr>
              <th className="th-left">Mã CP</th>
              <th className="th-left">Tên Công Ty</th>
              <th>Sàn</th>
              <th className="th-right">Khối Lượng</th>
              <th className="th-right">Giá TB Mua</th>
              <th className="th-right">Giá Hiện Tại</th>
              <th className="th-right">Tổng Giá Trị</th>
              <th className="th-right">Lãi / Lỗ</th>
              <th className="th-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {currentHoldings.map((item) => {
              const isProfit = (item.profitLoss || 0) >= 0;
              return (
                <tr key={item.ticker}>
                  <td className="th-left">
                    <span className="pf-ticker-badge mono-num">{item.ticker}</span>
                  </td>
                  <td className="th-left">
                    <span className="pf-company-name" title={item.companyName}>
                      {item.companyName}
                    </span>
                  </td>
                  <td>
                    <span className="pf-exchange-tag">{item.exchange}</span>
                  </td>
                  <td className="th-right tabular-num">
                    {item.quantity?.toLocaleString('vi-VN')}
                  </td>
                  <td className="th-right tabular-num">{formatPrice(item.avgBuyPrice)}</td>
                  <td className="th-right tabular-num font-bold">
                    {formatPrice(item.currentPrice)}
                  </td>
                  <td className="th-right tabular-num font-bold">
                    {formatPrice(item.totalValue)}
                  </td>
                  <td
                    className={`th-right tabular-num ${
                      isProfit ? 'text-bullish' : 'text-bearish'
                    }`}
                  >
                    <div className="pf-pnl-cell">
                      <span>
                        {isProfit ? '+' : ''}
                        {formatPrice(item.profitLoss)}
                      </span>
                      <span className="pf-pnl-small">
                        ({isProfit ? '+' : ''}
                        {(Number(item.profitLossPercent) || 0).toFixed(2)}%)
                      </span>
                    </div>
                  </td>
                  <td className="th-center">
                    <button
                      className="pf-action-sell-btn"
                      onClick={() =>
                        openTrade({
                          ticker: item.ticker,
                          side: 'SELL',
                          price: item.currentPrice,
                          quantity: item.quantity,
                        })
                      }
                      title={`Mở cửa sổ Đặt lệnh bán cho mã ${item.ticker}`}
                    >
                      Bán
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

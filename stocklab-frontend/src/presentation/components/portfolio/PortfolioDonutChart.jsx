import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  buildDonutChartData,
  getDonutChartOptions,
  formatPrice,
} from '@/service/portfolio.service';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PortfolioDonutChart({
  isAll,
  activeCustom,
  currentAllocations = [],
}) {
  const hasAllocations = Boolean(currentAllocations && currentAllocations.length > 0);
  const chartData = hasAllocations ? buildDonutChartData(currentAllocations) : null;
  const chartOptions = hasAllocations ? getDonutChartOptions(currentAllocations) : null;

  return (
    <div className="pf-allocation-surface">
      <div className="pf-section-heading">
        <span className="pf-section-kicker">CƠ CẤU DANH MỤC</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="pf-section-title">
            {isAll ? 'Cơ Cấu Tỷ Trọng Danh Mục Tổng' : `Cơ Cấu Phân Bổ: ${activeCustom?.name || 'Chiến Lược'}`}
          </h3>
          {hasAllocations && (
            <span className="pf-table-count mono-num">
              {currentAllocations.length} MÃ CỔ PHIẾU
            </span>
          )}
        </div>
      </div>

      {!hasAllocations || !chartData ? (
        <div className="pf-allocation-empty">
          <span className="pf-allocation-empty-icon">📊</span>
          <p className="pf-allocation-empty-text">
            {isAll
              ? 'Chưa có cổ phiếu trong danh mục để hiển thị biểu đồ phân bổ tỷ trọng.'
              : 'Danh mục này chưa được gán cổ phiếu nào. Hãy bấm "Chỉnh sửa" để phân bổ mã cổ phiếu.'}
          </p>
        </div>
      ) : (
        <div className="pf-allocation-content pf-allocation-layout">
          <div className="pf-chart-box pf-chart-wrapper">
            <Doughnut data={chartData} options={chartOptions} />
            <div className="pf-chart-center-badge pf-chart-donut-center">
              <span className="pf-center-count pf-donut-val mono-num">
                {currentAllocations.length}
              </span>
              <span className="pf-center-label pf-donut-label">MÃ CP</span>
            </div>
          </div>

          <div className="pf-allocation-legend-grid pf-legend-grid">
            {currentAllocations.map((a) => (
              <div key={a.ticker} className="pf-legend-item">
                <span
                  className="pf-legend-dot"
                  style={{ background: a.color || '#2563eb' }}
                />
                <div className="pf-legend-info">
                  <span className="pf-legend-ticker mono-num">{a.ticker}</span>
                  <span className="pf-legend-name">{a.companyName || a.ticker}</span>
                </div>
                <div className="pf-legend-values">
                  <span className="pf-legend-pct mono-num">
                    {(Number(a.percentage) || 0).toFixed(1)}%
                  </span>
                  <span className="pf-legend-val mono-num">
                    {formatPrice(a.value)} ₫
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

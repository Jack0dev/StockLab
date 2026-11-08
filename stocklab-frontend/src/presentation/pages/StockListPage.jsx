import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockAPI } from '@/infrastructure/repositories/api';
import { useWebSocket } from '@/presentation/controllers/useWebSocket';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { useQuickTrade } from '@/infrastructure/context/QuickTradeContext';
import { formatPrice, formatCompactVolume as formatVolume } from '@/service/trading.service';
import SearchBar from '@/presentation/components/SearchBar';
import './StockListPage.css';

const EXCHANGES = ['Tất cả', 'HOSE', 'HNX', 'UPCOM'];

export default function StockListPage() {
  const navigate = useNavigate();
  const { restartTour } = usePageTour('stocks');
  const { openTrade } = useQuickTrade();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedExchange, setSelectedExchange] = useState('Tất cả');
  const pageSize = 20;
  const [flashMap, setFlashMap] = useState({});
  const prevPricesRef = useRef({});

  // WebSocket: subscribe /topic/prices
  const handlePriceUpdate = useCallback((data) => {
    if (!Array.isArray(data)) return;
    const prevPrices = prevPricesRef.current;
    const newFlash = {};

    setStocks(prev => {
      return prev.map(stock => {
        const live = data.find(d => d.ticker === stock.ticker);
        if (!live) return stock;

        const oldPrice = prevPrices[stock.ticker] || stock.currentPrice;
        const newPrice = live.currentPrice;
        if (newPrice > oldPrice) newFlash[stock.ticker] = 'flash-up';
        else if (newPrice < oldPrice) newFlash[stock.ticker] = 'flash-down';

        prevPrices[stock.ticker] = newPrice;
        return { ...stock, ...live };
      });
    });

    if (Object.keys(newFlash).length > 0) {
      setFlashMap(newFlash);
      setTimeout(() => setFlashMap({}), 900);
    }
  }, []);

  const { connected } = useWebSocket('/topic/prices', handlePriceUpdate);

  useEffect(() => {
    fetchStocks();
  }, [currentPage, selectedExchange]);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const exchange = selectedExchange === 'Tất cả' ? '' : selectedExchange;
      const res = await stockAPI.getAll(currentPage, pageSize, 'ticker', exchange);
      if (res.data.success) {
        setStocks(res.data.data.content);
        setTotalPages(res.data.data.totalPages);
        setTotalElements(res.data.data.totalElements);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu cổ phiếu:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExchangeChange = (exchange) => {
    setSelectedExchange(exchange);
    setCurrentPage(0);
  };

  // Tính thống kê thị trường từ danh sách
  const marketMetrics = useMemo(() => {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let totalVol = 0;

    stocks.forEach(s => {
      totalVol += (s.volume || 0);
      if (s.change > 0) advances++;
      else if (s.change < 0) declines++;
      else unchanged++;
    });

    return { advances, declines, unchanged, totalVol };
  }, [stocks]);

  const getPriceColorClass = (stock) => {
    const cur = Number(stock.currentPrice);
    const ceil = Number(stock.ceilingPrice);
    const flr = Number(stock.floorPrice);
    const chg = Number(stock.change);

    if (!isNaN(cur) && !isNaN(ceil) && ceil > 0 && cur >= ceil) return 'text-ceiling';
    if (!isNaN(cur) && !isNaN(flr) && flr > 0 && cur <= flr) return 'text-floor';
    if (!isNaN(chg) && chg > 0) return 'text-bullish';
    if (!isNaN(chg) && chg < 0) return 'text-bearish';
    return 'text-ref';
  };

  return (
    <div className="stock-list-light fade-in">
      {/* 1. Creative Editorial Telemetry Bar (No icons, pure typographic elegance) */}
      <section className="editorial-telemetry-strip">
        <div className="telemetry-block">
          <span className="telemetry-tag">VN-INDEX</span>
          <div className="telemetry-figures">
            <span className="telemetry-val tabular-num">1,285.40</span>
            <span className="telemetry-delta text-bullish tabular-num">↑ 11.85 (+0.93%)</span>
          </div>
        </div>

        <div className="telemetry-divider">/</div>

        <div className="telemetry-block">
          <span className="telemetry-tag">VN30</span>
          <div className="telemetry-figures">
            <span className="telemetry-val tabular-num">1,310.22</span>
            <span className="telemetry-delta text-bullish tabular-num">↑ 14.60 (+1.13%)</span>
          </div>
        </div>

        <div className="telemetry-divider">/</div>

        <div className="telemetry-block">
          <span className="telemetry-tag">HNX-INDEX</span>
          <div className="telemetry-figures">
            <span className="telemetry-val tabular-num">243.80</span>
            <span className="telemetry-delta text-bearish tabular-num">↓ 0.45 (-0.18%)</span>
          </div>
        </div>

        <div className="telemetry-divider">/</div>

        {/* Market Breadth Tally */}
        <div className="telemetry-tally">
          <div className="tally-item text-bullish">
            <span className="tally-count tabular-num">{marketMetrics.advances}</span>
            <span className="tally-label">Tăng</span>
          </div>
          <div className="tally-item text-bearish">
            <span className="tally-count tabular-num">{marketMetrics.declines}</span>
            <span className="tally-label">Giảm</span>
          </div>
          <div className="tally-item text-ref">
            <span className="tally-count tabular-num">{marketMetrics.unchanged}</span>
            <span className="tally-label">Đứng giá</span>
          </div>
          <div className="tally-vol">
            <span className="tally-vol-label">Tổng Khối Lượng:</span>
            <span className="tally-vol-val tabular-num">{formatVolume(marketMetrics.totalVol)}</span>
          </div>
        </div>
      </section>

      {/* 2. Control Strip */}
      <div className="table-action-strip">
        <div className="strip-left">
          <div className="exchange-tabs">
            {EXCHANGES.map(ex => (
              <button
                key={ex}
                className={`exchange-tab-btn ${selectedExchange === ex ? 'active' : ''}`}
                onClick={() => handleExchangeChange(ex)}
              >
                {ex}
              </button>
            ))}
          </div>

          <span className="feed-status-text">
            {connected ? '● Trực tuyến' : '○ Mất kết nối'}
          </span>
        </div>

        <div className="strip-right">
          <SearchBar />
          <button className="text-tool-btn" onClick={fetchStocks}>Làm mới</button>
          <button className="text-tool-btn" onClick={restartTour}>Trợ giúp</button>
        </div>
      </div>

      {/* 3. Editorial Stock Table */}
      <div className="light-table-container">
        {loading ? (
          <div className="loading-state-block">
            <div className="spinner"></div>
            <span>Đang đồng bộ dữ liệu bảng giá...</span>
          </div>
        ) : stocks.length === 0 ? (
          <div className="empty-state-block">
            <span>Không tìm thấy cổ phiếu phù hợp</span>
          </div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th className="th-code">Mã</th>
                  <th className="th-name">Tên Công Ty</th>
                  <th className="th-sàn">Sàn</th>
                  <th className="th-num th-ceiling">Trần</th>
                  <th className="th-num th-floor">Sàn</th>
                  <th className="th-num th-ref">TC</th>
                  <th className="th-num th-current">Giá Khớp</th>
                  <th className="th-num th-diff">+/-</th>
                  <th className="th-num th-pct">%</th>
                  <th className="th-num th-high">Cao</th>
                  <th className="th-num th-low">Thấp</th>
                  <th className="th-num th-vol">KL Khớp</th>
                  <th className="th-btn">Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(stock => {
                  const priceClass = getPriceColorClass(stock);
                  const isBull = stock.change > 0;
                  const isBear = stock.change < 0;

                  return (
                    <tr 
                      key={stock.id} 
                      className="table-data-row"
                      onClick={() => navigate(`/stocks/${stock.ticker}`)}
                    >
                      {/* Mã CP */}
                      <td className="td-code">
                        <span className="stock-code-pill mono-num">{stock.ticker}</span>
                      </td>

                      {/* Tên công ty */}
                      <td className="td-name">
                        <span className="stock-company-label" title={stock.companyName}>
                          {stock.companyName}
                        </span>
                      </td>

                      {/* Sàn */}
                      <td className="td-sàn">
                        <span className="exchange-text-tag">{stock.exchange}</span>
                      </td>

                      {/* Giá Trần */}
                      <td className="td-num text-ceiling tabular-num">
                        {formatPrice(stock.ceilingPrice)}
                      </td>

                      {/* Giá Sàn */}
                      <td className="td-num text-floor tabular-num">
                        {formatPrice(stock.floorPrice)}
                      </td>

                      {/* Giá TC */}
                      <td className="td-num text-ref tabular-num">
                        {formatPrice(stock.referencePrice)}
                      </td>

                      {/* Giá Khớp */}
                      <td className={`td-num font-bold ${priceClass} ${flashMap[stock.ticker] || ''} tabular-num`}>
                        {formatPrice(stock.currentPrice)}
                      </td>

                      {/* +/- */}
                      <td className={`td-num ${priceClass} tabular-num`}>
                        {isBull ? '+' : ''}{formatPrice(stock.change)}
                      </td>

                      {/* % Thay đổi */}
                      <td className="td-num">
                        <span className={`change-pill ${
                          priceClass === 'text-ceiling' ? 'pill-ceil' :
                          priceClass === 'text-floor' ? 'pill-floor' :
                          isBull ? 'pill-bull' :
                          isBear ? 'pill-bear' : 'pill-ref'
                        } tabular-num`}>
                          {isBull ? '↑ ' : isBear ? '↓ ' : '— '}
                          {stock.changePercent !== undefined ? `${Math.abs(stock.changePercent).toFixed(2)}%` : '0.00%'}
                        </span>
                      </td>

                      {/* Cao */}
                      <td className="td-num text-bullish tabular-num">
                        {formatPrice(stock.highPrice)}
                      </td>

                      {/* Thấp */}
                      <td className="td-num text-bearish tabular-num">
                        {formatPrice(stock.lowPrice)}
                      </td>

                      {/* Khối lượng */}
                      <td className="td-num text-secondary tabular-num">
                        {formatVolume(stock.volume)}
                      </td>

                      {/* Đặt lệnh */}
                      <td className="td-btn" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="trade-cta-link"
                          onClick={() => openTrade({ ticker: stock.ticker, side: 'BUY', price: stock.currentPrice })}
                          title={`Mở cửa sổ Đặt lệnh nhanh cho mã ${stock.ticker}`}
                        >
                          Đặt Lệnh
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Minimalist Pager */}
        {totalPages > 1 && (
          <div className="table-pager-footer">
            <span className="pager-meta">
              Trang <strong>{currentPage + 1}</strong> / {totalPages} (Tổng số {totalElements} mã niêm yết)
            </span>

            <div className="pager-actions">
              <button
                className="pager-btn"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              >
                Trước
              </button>

              <div className="pager-num-group">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = currentPage < 3 ? i
                    : currentPage > totalPages - 3 ? totalPages - 5 + i
                    : currentPage - 2 + i;
                  if (pageNum < 0 || pageNum >= totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      className={`pager-num-btn ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>

              <button
                className="pager-btn"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockAPI } from '../api/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { usePageTour } from '../hooks/usePageTour';
import SearchBar from '../components/SearchBar';
import './StockListPage.css';

const EXCHANGES = ['Tất cả', 'HOSE', 'HNX', 'UPCOM'];

export default function StockListPage() {
  const navigate = useNavigate();
  const { restartTour } = usePageTour('stocks');
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedExchange, setSelectedExchange] = useState('Tất cả');
  const pageSize = 20;
  const [flashMap, setFlashMap] = useState({}); // ticker -> 'flash-up' | 'flash-down'
  const prevPricesRef = useRef({}); // ticker -> previousPrice

  // WebSocket: subscribe /topic/prices
  const handlePriceUpdate = useCallback((data) => {
    if (!Array.isArray(data)) return;
    const prevPrices = prevPricesRef.current;
    const newFlash = {};

    setStocks(prev => {
      return prev.map(stock => {
        const live = data.find(d => d.ticker === stock.ticker);
        if (!live) return stock;

        // Detect price change for flash animation
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
      setTimeout(() => setFlashMap({}), 800);
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

  const formatPrice = (price) => {
    if (!price) return '0';
    return Number(price).toLocaleString('vi-VN');
  };

  const formatVolume = (vol) => {
    if (!vol) return '0';
    if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
    if (vol >= 1_000) return (vol / 1_000).toFixed(0) + 'K';
    return vol.toLocaleString('vi-VN');
  };

  const getPriceClass = (change) => {
    if (change > 0) return 'price-up';
    if (change < 0) return 'price-down';
    return 'price-ref';
  };

  const getChangeClass = (change) => {
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'ref';
  };

  const getTickerColor = (ticker) => {
    const colors = [
      '#2962ff', '#00c853', '#ff6d00', '#aa00ff',
      '#d50000', '#00bfa5', '#6200ea', '#c51162',
      '#0091ea', '#00c853', '#ffd600', '#304ffe'
    ];
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) {
      hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getExchangeClass = (exchange) => {
    switch (exchange?.toUpperCase()) {
      case 'HOSE': return 'exchange-hose';
      case 'HNX': return 'exchange-hnx';
      case 'UPCOM': return 'exchange-upcom';
      default: return '';
    }
  };

  return (
    <div className="stock-list-page fade-in">
      {/* Header */}
      <div className="stock-list-header">
        <h2>
          📊 Bảng giá
          <span className="stock-count">({totalElements} mã)</span>
          {connected && <span className="ws-live-badge">🟢 LIVE</span>}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <SearchBar />
          <div className="exchange-filter">
            {EXCHANGES.map(ex => (
              <button
                key={ex}
                className={`exchange-btn ${selectedExchange === ex ? 'active' : ''}`}
                onClick={() => handleExchangeChange(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
        </div>
      </div>

      {/* Table */}
      <div className="stock-table-wrapper">
        {loading ? (
          <div className="stock-loading">
            <div className="spinner"></div>
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : stocks.length === 0 ? (
          <div className="stock-empty">
            <span style={{ fontSize: '2rem' }}>📭</span>
            <span>Không có dữ liệu cổ phiếu</span>
          </div>
        ) : (
          <>
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Mã CP</th>
                  <th>Tên công ty</th>
                  <th>Sàn</th>
                  <th>Giá hiện tại</th>
                  <th>Giá TC</th>
                  <th>Mở cửa</th>
                  <th>Cao nhất</th>
                  <th>Thấp nhất</th>
                  <th>KL</th>
                  <th>+/-</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(stock => {
                  const priceClass = getPriceClass(stock.change);
                  const changeClass = getChangeClass(stock.change);
                  return (
                    <tr key={stock.id} onClick={() => navigate(`/stocks/${stock.ticker}`)}>
                      <td>
                        <div className="ticker-cell">
                          <div
                            className="ticker-icon"
                            style={{ background: getTickerColor(stock.ticker) }}
                          >
                            {stock.ticker.substring(0, 2)}
                          </div>
                          <span className="ticker-symbol">{stock.ticker}</span>
                        </div>
                      </td>
                      <td>
                        <span className="company-name-cell">{stock.companyName}</span>
                      </td>
                      <td>
                        <span className={`exchange-badge ${getExchangeClass(stock.exchange)}`}>
                          {stock.exchange}
                        </span>
                      </td>
                      <td className={`price-cell ${priceClass} ${flashMap[stock.ticker] || ''}`}>
                        {formatPrice(stock.currentPrice)}
                      </td>
                      <td className="price-cell price-ref">
                        {formatPrice(stock.referencePrice)}
                      </td>
                      <td className="price-cell">
                        {formatPrice(stock.openPrice)}
                      </td>
                      <td className="price-cell price-up">
                        {formatPrice(stock.highPrice)}
                      </td>
                      <td className="price-cell price-down">
                        {formatPrice(stock.lowPrice)}
                      </td>
                      <td className="volume-cell">
                        {formatVolume(stock.volume)}
                      </td>
                      <td>
                        <span className={`change-badge ${changeClass}`}>
                          {stock.change > 0 ? '+' : ''}{formatPrice(stock.change)}
                        </span>
                      </td>
                      <td>
                        <span className={`change-badge ${changeClass}`}>
                          {stock.changePercent > 0 ? '▲' : stock.changePercent < 0 ? '▼' : '–'}
                          {' '}{Math.abs(stock.changePercent).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="stock-pagination">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  ← Trước
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = currentPage < 3 ? i
                    : currentPage > totalPages - 3 ? totalPages - 5 + i
                    : currentPage - 2 + i;
                  if (pageNum < 0 || pageNum >= totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <span className="pagination-info">
                  Trang {currentPage + 1}/{totalPages}
                </span>
                <button
                  className="pagination-btn"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Sau →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

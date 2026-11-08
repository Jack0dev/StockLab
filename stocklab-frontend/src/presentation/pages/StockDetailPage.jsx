import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { stockAPI, orderAPI, watchlistAPI, newsAPI } from '@/infrastructure/repositories/api';
import { useAuth } from '@/infrastructure/context/AuthContext';
import { useQuickTrade } from '@/infrastructure/context/QuickTradeContext';
import { useWebSocket } from '@/presentation/controllers/useWebSocket';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import TradingViewSimulatedChart from '@/presentation/components/TradingViewSimulatedChart';
import './StockDetailPage.css';

const MAIN_TABS = ['Giao dịch', 'Biểu đồ Kỹ thuật', 'Hồ sơ', 'Tin tức', 'Thống kê', 'Tài chính'];

export default function StockDetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openTrade } = useQuickTrade();
  const { restartTour } = usePageTour('stockDetail');

  // Stock & page states
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState('3m');
  const [mainTab, setMainTab] = useState('Giao dịch');
  const [isWatched, setIsWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  // Order book & indicator backend states
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [indicators, setIndicators] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [news, setNews] = useState([]);

  // Realtime Price Updates via WebSocket
  const handlePriceUpdate = useCallback((data) => {
    if (!Array.isArray(data)) return;
    const live = data.find(d => d.ticker === ticker);
    if (live) setStock(prev => (prev ? { ...prev, ...live } : prev));
  }, [ticker]);
  const { connected } = useWebSocket('/topic/prices', handlePriceUpdate);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(() => fetchOrderBook(), 5000);
    return () => clearInterval(iv);
  }, [ticker]);

  useEffect(() => {
    if (stock && (mainTab === 'Giao dịch' || mainTab === 'Biểu đồ Kỹ thuật' || mainTab === 'Thống kê')) {
      fetchPriceHistory(selectedRange);
    }
  }, [selectedRange, stock?.ticker, mainTab]);

  // Data fetching
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [stockRes] = await Promise.all([stockAPI.getByTicker(ticker)]);
      if (stockRes.data.success) setStock(stockRes.data.data);
    } catch (err) {
      console.error('Lỗi tải thông tin cổ phiếu:', err);
    } finally {
      setLoading(false);
    }
    fetchOrderBook();
    fetchIndicators();
    fetchNews();
    checkWatchlist();
  };

  const fetchOrderBook = async () => {
    try {
      const r = await orderAPI.getOrderBook(ticker);
      if (r.data.success) setOrderBook(r.data.data);
    } catch {}
  };

  const fetchIndicators = async () => {
    try {
      const r = await stockAPI.getIndicators(ticker);
      if (r.data.success) setIndicators(r.data.data);
    } catch {}
  };

  const fetchNews = async () => {
    try {
      const r = await newsAPI.getByTicker(ticker);
      if (r.data?.success && Array.isArray(r.data.data)) {
        setNews(r.data.data);
      } else if (Array.isArray(r.data)) {
        setNews(r.data);
      } else {
        setNews([]);
      }
    } catch {
      setNews([]);
    }
  };

  const checkWatchlist = async () => {
    try {
      const r = await watchlistAPI.isWatched(ticker);
      if (r.data.success) setIsWatched(r.data.data);
    } catch {}
  };

  const toggleWatchlist = async () => {
    setWatchLoading(true);
    try {
      if (isWatched) {
        await watchlistAPI.remove(ticker);
        setIsWatched(false);
      } else {
        await watchlistAPI.add(ticker);
        setIsWatched(true);
      }
    } catch {}
    setWatchLoading(false);
  };

  const fetchPriceHistory = async (range) => {
    try {
      const r = range === '1d' || range === '5d' ? '1W' : range === 'All' ? 'ALL' : range.toUpperCase();
      const res = await stockAPI.getPriceHistory(ticker, r);
      if (res.data.success && res.data.data) {
        setPriceHistory(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử giá:', err);
    }
  };

  // Format Helpers
  const fmt = (p) => (p != null ? Number(p).toLocaleString('vi-VN') : '—');
  const fmtVol = (v) => {
    if (!v) return '0';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toLocaleString();
  };
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('vi-VN');
  };
  const cls = (c) => (c > 0 ? 'c-up' : c < 0 ? 'c-down' : 'c-ref');

  if (loading) {
    return (
      <div className="sd-page">
        <div className="sd-loading">
          <div className="spinner"></div>
          <span>Đang tải thông tin cổ phiếu...</span>
        </div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="sd-page">
        <div className="sd-loading">
          Không tìm thấy mã cổ phiếu: {ticker}
          <br />
          <button className="sd-btn" onClick={() => navigate('/stocks')}>
            ← Quay lại Bảng giá
          </button>
        </div>
      </div>
    );
  }

  const ceil = stock.ceilingPrice ?? (stock.referencePrice ? (+stock.referencePrice * 1.07).toFixed(0) : 0);
  const floor = stock.floorPrice ?? (stock.referencePrice ? (+stock.referencePrice * 0.93).toFixed(0) : 0);
  const totalBid = orderBook.bids?.reduce((s, b) => s + (b.totalQuantity || 0), 0) || 0;
  const totalAsk = orderBook.asks?.reduce((s, a) => s + (a.totalQuantity || 0), 0) || 0;
  const bidPct = totalBid + totalAsk > 0 ? (totalBid / (totalBid + totalAsk)) * 100 : 50;

  return (
    <div className="sd-page fade-in">
      {/* ===== HEADER ===== */}
      <div className="sd-header">
        <div className="sd-h-left">
          <button className="sd-back" onClick={() => navigate(user?.role === 'ADMIN' ? '/admin/stocks' : '/stocks')}>
            {user?.role === 'ADMIN' ? '← Quản lý Cổ phiếu' : '← Bảng giá'}
          </button>
          <span className="sd-ticker">{stock.ticker}</span>
          <span className={`sd-exch ex-${stock.exchange?.toLowerCase()}`}>{stock.exchange}</span>
          <span className="sd-comp">{stock.companyName}</span>
        </div>
        <div className="sd-h-price">
          <div className="sd-h-main-price">
            <span className={`sd-big-price ${cls(stock.change)}`}>{fmt(stock.currentPrice)}</span>
            <span className={`sd-chg-badge ${cls(stock.change)}`}>
              <span>{stock.change > 0 ? '+' : ''}{fmt(stock.change)}</span>
              <span>({stock.changePercent > 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%)</span>
            </span>
          </div>
          <div className="sd-h-sub">
            MỞ CỬA/TB: <span>{fmt(stock.openPrice)}/{fmt(stock.referencePrice)}</span>
            &nbsp;&nbsp;THẤP/CAO: <span>{fmt(stock.lowPrice)}/{fmt(stock.highPrice)}</span>
          </div>
        </div>
        <div className="sd-h-ceil-floor">
          <div className="sd-cf-item">
            <span className="sd-cf-label">Giá Trần</span>
            <span className="sd-cf-val c-ceil">{fmt(ceil)}</span>
          </div>
          <div className="sd-cf-item">
            <span className="sd-cf-label">Giá Sàn</span>
            <span className="sd-cf-val c-floor">{fmt(floor)}</span>
          </div>
          <div className="sd-cf-item">
            <span className="sd-cf-label">Tham Chiếu</span>
            <span className="sd-cf-val c-ref">{fmt(stock.referencePrice)}</span>
          </div>
        </div>
        <div className="sd-h-vol">
          TỔNG KL: <span className="c-vol">{fmtVol(stock.volume)} CP</span>
        </div>
        <div className="sd-h-actions">
          {user?.role === 'ADMIN' ? (
            <button className="sd-btn-primary" onClick={() => navigate('/admin/stocks')}>
              Quản trị Cổ phiếu
            </button>
          ) : (
            <button
              className="sd-btn-primary"
              onClick={() => openTrade({ ticker, side: 'BUY', price: stock?.currentPrice || stock?.referencePrice })}
              title={`Mở cửa sổ Đặt lệnh nhanh cho mã ${ticker}`}
            >
              Đặt lệnh ngay
            </button>
          )}
          <button
            className={`sd-watch ${isWatched ? 'on' : ''}`}
            onClick={toggleWatchlist}
            disabled={watchLoading}
            title={isWatched ? 'Bỏ theo dõi' : 'Thêm vào danh mục theo dõi'}
          >
            {isWatched ? '★' : '☆'}
          </button>
          <button className="help-text-btn" onClick={restartTour} title="Hướng dẫn sử dụng">
            Trợ giúp
          </button>
          {connected && <span className="sd-live">Live</span>}
        </div>
      </div>

      {/* ===== MAIN TABS ===== */}
      <div className="sd-main-tabs">
        {MAIN_TABS.map((t) => (
          <button
            key={t}
            className={mainTab === t ? 'active' : ''}
            onClick={() => setMainTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="sd-content">
        {/* ====== TAB: Giao dịch ====== */}
        {mainTab === 'Giao dịch' && (
          <div className="sd-trading-layout">
            <div className="sd-chart-area">
              <TradingViewSimulatedChart
                stock={stock}
                priceHistory={priceHistory}
                selectedRange={selectedRange}
                onRangeChange={setSelectedRange}
              />
            </div>

            <div className="sd-right-col">
              {/* Order Book */}
              <div className="sd-ob-panel">
                <h4 className="sd-panel-title">Độ sâu thị trường (Order Book)</h4>
                <table className="sd-ob-table">
                  <thead>
                    <tr>
                      <th className="th-b">KL Mua</th>
                      <th className="th-b">Giá Mua</th>
                      <th className="th-s">Giá Bán</th>
                      <th className="th-s">KL Bán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const bid = orderBook.bids?.[i];
                      const ask = orderBook.asks?.[i];
                      return (
                        <tr key={i}>
                          <td className="ob-bv">{bid ? fmtVol(bid.totalQuantity) : ''}</td>
                          <td className="ob-bp">{bid ? fmt(bid.price) : ''}</td>
                          <td className="ob-ap">{ask ? fmt(ask.price) : ''}</td>
                          <td className="ob-av">{ask ? fmtVol(ask.totalQuantity) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="sd-depth-bar">
                  <div className="sd-db-fill-bid" style={{ width: `${bidPct}%` }}></div>
                  <div className="sd-db-fill-ask" style={{ width: `${100 - bidPct}%` }}></div>
                </div>
                <div className="sd-depth-info">
                  <span className="c-up">Dư mua: {fmtVol(totalBid)}</span>
                  <span className="c-down">Dư bán: {fmtVol(totalAsk)}</span>
                </div>
              </div>

              {/* Matched / Khop lenh */}
              <div className="sd-matched-panel">
                <h4 className="sd-panel-title">Nhật ký khớp lệnh gần nhất</h4>
                <div className="sd-ml-head">
                  <span>Thời gian</span>
                  <span>Khối lượng</span>
                  <span>Mức giá</span>
                  <span>Biến động</span>
                </div>
                {orderBook.bids?.slice(0, 6).map((b, i) => (
                  <div className="sd-ml-row" key={`b${i}`}>
                    <span className="sd-ml-t">
                      {new Date().toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span>{fmtVol(b.totalQuantity)}</span>
                    <span className="c-up" style={{ fontWeight: '700' }}>
                      {fmt(b.price)}
                    </span>
                    <span className="c-ref">{stock.changePercent?.toFixed(1)}%</span>
                  </div>
                ))}
                {orderBook.asks?.slice(0, 6).map((a, i) => (
                  <div className="sd-ml-row" key={`a${i}`}>
                    <span className="sd-ml-t">
                      {new Date().toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span>{fmtVol(a.totalQuantity)}</span>
                    <span className="c-down" style={{ fontWeight: '700' }}>
                      {fmt(a.price)}
                    </span>
                    <span className="c-ref">{stock.changePercent?.toFixed(1)}%</span>
                  </div>
                ))}
                {!orderBook.bids?.length && !orderBook.asks?.length && (
                  <div className="sd-empty">Chưa ghi nhận lệnh khớp trong phiên</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB: Biểu đồ Kỹ thuật (TradingView Full Width) ====== */}
        {mainTab === 'Biểu đồ Kỹ thuật' && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              background: '#f8fafc',
              minHeight: 'calc(100vh - 140px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                marginBottom: '0.65rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#090d16' }}>
                  Khung Biểu đồ Kỹ thuật Mô phỏng TradingView - {stock.ticker}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Hệ thống công cụ phân tích kỹ thuật (MA, EMA, Bollinger, Kháng cự, Hỗ trợ, Thước đo) áp dụng trên dữ liệu khớp lệnh mô phỏng của hệ thống StockLab.
                </p>
              </div>
              <button
                className="sd-btn-primary"
                onClick={() => navigate(`/trading?ticker=${ticker}`)}
              >
                Đặt lệnh {stock.ticker}
              </button>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: '620px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#ffffff',
              }}
            >
              <TradingViewSimulatedChart
                stock={stock}
                priceHistory={priceHistory}
                selectedRange={selectedRange}
                onRangeChange={setSelectedRange}
                fullHeight={true}
              />
            </div>
          </div>
        )}

        {/* ====== TAB: Hồ sơ ====== */}
        {mainTab === 'Hồ sơ' && (
          <div className="sd-profile-layout">
            <div className="sd-profile-main">
              <div className="sd-profile-body">
                <h3>{stock.companyName}</h3>
                <p className="sd-profile-desc">
                  {stock.companyName} ({stock.ticker}) là doanh nghiệp niêm yết chính thức trên sàn giao dịch {stock.exchange}.
                  Cổ phiếu nằm trong danh mục giám sát giao dịch trực tiếp và quản trị danh mục đầu tư mô phỏng của hệ thống StockLab.
                </p>
                <div className="sd-profile-info-grid">
                  <div className="sd-pi"><span>Mã chứng khoán</span><span>{stock.ticker}</span></div>
                  <div className="sd-pi"><span>Sàn niêm yết</span><span>{stock.exchange}</span></div>
                  <div className="sd-pi"><span>Giá thị trường</span><span className={cls(stock.change)}>{fmt(stock.currentPrice)} đ</span></div>
                  <div className="sd-pi"><span>Giá tham chiếu</span><span className="c-ref">{fmt(stock.referencePrice)} đ</span></div>
                  <div className="sd-pi"><span>Khối lượng phiên</span><span>{fmtVol(stock.volume)} CP</span></div>
                  <div className="sd-pi"><span>Tình trạng niêm yết</span><span className={stock.isActive ? 'c-up' : 'c-down'}>{stock.isActive ? 'Đang giao dịch' : 'Tạm ngưng'}</span></div>
                </div>
              </div>
            </div>
            <div className="sd-profile-side">
              <h4>Cổ phiếu tiêu biểu cùng sàn</h4>
              <div className="sd-same-list">
                {['VCB', 'TCB', 'MBB', 'BID', 'CTG', 'HPG', 'FPT', 'VNM']
                  .filter((t) => t !== ticker.toUpperCase())
                  .slice(0, 6)
                  .map((t) => (
                    <div
                      className="sd-same-item"
                      key={t}
                      onClick={() => navigate(`/stocks/${t}`)}
                    >
                      <span className="sd-same-ticker">{t}</span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Xem chi tiết →</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB: Tin tức ====== */}
        {mainTab === 'Tin tức' && (
          <div className="sd-news-layout">
            {news.length > 0 ? (
              <div className="sd-news-grid">
                {news.map((item, i) => (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sd-news-card"
                    key={item.id || item.link || i}
                  >
                    {item.thumbnail && (
                      <div className="sd-news-thumb-wrap">
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="sd-news-thumb"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.parentElement.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="sd-news-body">
                      <h4>{item.title}</h4>
                      <p>{item.description ? (item.description.length > 130 ? item.description.substring(0, 130) + '...' : item.description) : ''}</p>
                      <div className="sd-news-meta">
                        <span className="sd-news-source-tag">{item.source || 'Tin tức'}</span>
                        <span className="sd-news-date">
                          {item.publishedAt || fmtDate(item.pubDate)}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="sd-empty-big">Chưa có bản tin nào về mã cổ phiếu này. Hệ thống đang đồng bộ dữ liệu...</div>
            )}
          </div>
        )}

        {/* ====== TAB: Thống kê ====== */}
        {mainTab === 'Thống kê' && (
          <div className="sd-stats-layout">
            <div className="sd-stats-card">
              <table className="sd-stats-table">
                <thead>
                  <tr>
                    <th>Ngày giao dịch</th>
                    <th>Biến động</th>
                    <th>Đóng cửa</th>
                    <th>Khối lượng</th>
                    <th>Mở cửa</th>
                    <th>Cao nhất</th>
                    <th>Thấp nhất</th>
                    <th>Bình quân</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((d, i) => {
                      const chg = (+d.close - +d.open).toFixed(0);
                      const chgPct = +d.open > 0 ? (((+d.close - +d.open) / +d.open) * 100).toFixed(2) : '0';
                      const avg = ((+d.high + +d.low) / 2).toFixed(0);
                      return (
                        <tr key={i}>
                          <td>{fmtDate(d.tradingDate)}</td>
                          <td>
                            <span
                              className={+chg > 0 ? 'c-up' : +chg < 0 ? 'c-down' : ''}
                              style={{ fontWeight: '700' }}
                            >
                              {+chg > 0 ? '▲' : +chg < 0 ? '▼' : '–'} {fmt(Math.abs(+chg))} ({chgPct}%)
                            </span>
                          </td>
                          <td style={{ fontWeight: '700' }}>{fmt(d.close)}</td>
                          <td>{fmtVol(d.volume)}</td>
                          <td>{fmt(d.open)}</td>
                          <td className="c-up">{fmt(d.high)}</td>
                          <td className="c-down">{fmt(d.low)}</td>
                          <td>{fmt(avg)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {priceHistory.length === 0 && (
              <div className="sd-empty-big">Đang đồng bộ dữ liệu lịch sử giá...</div>
            )}
          </div>
        )}

        {/* ====== TAB: Tài chính ====== */}
        {mainTab === 'Tài chính' && (
          <div className="sd-fin-layout">
            <div className="sd-fin-main">
              <h4>Chỉ số kỹ thuật & Định giá tài chính</h4>
              {indicators ? (
                <div className="sd-fin-grid">
                  <div className="sd-fin-section">
                    <h5>Định giá & Xu hướng</h5>
                    <div className="sd-fi">
                      <span>RSI (14)</span>
                      <span className={indicators.rsi14 > 70 ? 'c-down' : indicators.rsi14 < 30 ? 'c-up' : 'c-ref'}>
                        {indicators.rsi14?.toFixed(1)}{' '}
                        {indicators.rsi14 > 70 ? '(Quá mua)' : indicators.rsi14 < 30 ? '(Quá bán)' : '(Trung tính)'}
                      </span>
                    </div>
                    <div className="sd-fi">
                      <span>MACD</span>
                      <span className={indicators.histogram > 0 ? 'c-up' : 'c-down'}>
                        {indicators.macdLine?.toFixed(0)}
                      </span>
                    </div>
                    <div className="sd-fi">
                      <span>Signal Line</span>
                      <span>{indicators.signalLine?.toFixed(0)}</span>
                    </div>
                    <div className="sd-fi">
                      <span>Histogram</span>
                      <span className={indicators.histogram > 0 ? 'c-up' : 'c-down'}>
                        {indicators.histogram?.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="sd-fin-section">
                    <h5>Đường trung bình (Moving Averages)</h5>
                    <div className="sd-fi"><span>SMA (20)</span><span>{fmt(indicators.sma20)} đ</span></div>
                    <div className="sd-fi"><span>SMA (50)</span><span>{fmt(indicators.sma50)} đ</span></div>
                    <div className="sd-fi"><span>EMA (12)</span><span>{fmt(indicators.ema12)} đ</span></div>
                    <div className="sd-fi"><span>EMA (26)</span><span>{fmt(indicators.ema26)} đ</span></div>
                  </div>
                  <div className="sd-fin-section">
                    <h5>Dải Bollinger Bands</h5>
                    <div className="sd-fi"><span>BB Upper</span><span className="c-up">{fmt(indicators.bollingerUpper)} đ</span></div>
                    <div className="sd-fi"><span>BB Middle</span><span className="c-ref">{fmt(indicators.bollingerMiddle)} đ</span></div>
                    <div className="sd-fi"><span>BB Lower</span><span className="c-down">{fmt(indicators.bollingerLower)} đ</span></div>
                  </div>
                  <div className="sd-fin-section">
                    <h5>Khối lượng & Biên độ 52 tuần</h5>
                    <div className="sd-fi"><span>KL phiên hiện tại</span><span>{fmtVol(indicators.currentVolume)} CP</span></div>
                    <div className="sd-fi"><span>KL TB 20 phiên</span><span>{fmtVol(indicators.avgVolume20)} CP</span></div>
                    <div className="sd-fi">
                      <span>Hệ số Volume Ratio</span>
                      <span className={indicators.volumeRatio > 1.5 ? 'c-up' : ''}>
                        {indicators.volumeRatio?.toFixed(2)}x
                      </span>
                    </div>
                    <div className="sd-fi"><span>52 tuần cao nhất</span><span className="c-up">{fmt(indicators.weekHigh52)} đ</span></div>
                    <div className="sd-fi"><span>52 tuần thấp nhất</span><span className="c-down">{fmt(indicators.weekLow52)} đ</span></div>
                  </div>
                </div>
              ) : (
                <div className="sd-empty-big">Đang đồng bộ chỉ số kỹ thuật từ hệ thống...</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

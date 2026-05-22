import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { stockAPI, orderAPI, watchlistAPI, newsAPI } from '../api/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './StockDetailPage.css';

const RANGES = ['1d', '5d', '1m', '3m', '6m', '1y', 'All'];
const MAIN_TABS = ['Giao dịch', 'Hồ sơ', 'Tin tức', 'Thống kê', 'Tài chính'];

export default function StockDetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState('3m');
  const [mainTab, setMainTab] = useState('Giao dịch');
  const [isWatched, setIsWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [indicators, setIndicators] = useState(null);

  const [priceHistory, setPriceHistory] = useState([]);
  const [news, setNews] = useState([]);

  // Realtime
  const handlePriceUpdate = useCallback((data) => {
    if (!Array.isArray(data)) return;
    const live = data.find(d => d.ticker === ticker);
    if (live) setStock(prev => prev ? { ...prev, ...live } : prev);
  }, [ticker]);
  const { connected } = useWebSocket('/topic/prices', handlePriceUpdate);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(() => fetchOrderBook(), 5000);
    return () => clearInterval(iv);
  }, [ticker]);

  useEffect(() => {
    if (stock && mainTab === 'Giao dịch') fetchPriceHistory(selectedRange);
  }, [selectedRange, stock?.ticker, mainTab]);

  useEffect(() => {
    return () => { if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [stockRes] = await Promise.all([stockAPI.getByTicker(ticker)]);
      if (stockRes.data.success) setStock(stockRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
    fetchOrderBook();
    fetchIndicators();

    fetchNews();
    checkWatchlist();
  };

  const fetchOrderBook = async () => {
    try { const r = await orderAPI.getOrderBook(ticker); if (r.data.success) setOrderBook(r.data.data); } catch {}
  };
  const fetchIndicators = async () => {
    try { const r = await stockAPI.getIndicators(ticker); if (r.data.success) setIndicators(r.data.data); } catch {}
  };


  const fetchNews = async () => {
    try { const r = await newsAPI.getLatest(); setNews(Array.isArray(r.data) ? r.data : []); } catch {}
  };
  const checkWatchlist = async () => {
    try { const r = await watchlistAPI.isWatched(ticker); if (r.data.success) setIsWatched(r.data.data); } catch {}
  };
  const toggleWatchlist = async () => {
    setWatchLoading(true);
    try {
      if (isWatched) { await watchlistAPI.remove(ticker); setIsWatched(false); }
      else { await watchlistAPI.add(ticker); setIsWatched(true); }
    } catch {}
    setWatchLoading(false);
  };

  const fetchPriceHistory = async (range) => {
    try {
      const r = range === '1d' || range === '5d' ? '1W' : range === 'All' ? 'ALL' : range.toUpperCase();
      const res = await stockAPI.getPriceHistory(ticker, r);
      if (res.data.success && res.data.data) {
        setPriceHistory(res.data.data);
        renderChart(res.data.data);
      }
    } catch {}
  };

  const renderChart = (data) => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: '#0c0f14' }, textColor: '#6a6f7e' },
      grid: { vertLines: { color: '#161b25' }, horzLines: { color: '#161b25' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#1c2030', scaleMargins: { top: 0.05, bottom: 0.25 } },
      timeScale: { borderColor: '#1c2030', timeVisible: false },
    });
    chartRef.current = chart;
    const cs = chart.addSeries(CandlestickSeries, {
      upColor: '#00c853', downColor: '#ff1744',
      borderDownColor: '#ff1744', borderUpColor: '#00c853',
      wickDownColor: '#ff1744', wickUpColor: '#00c853',
    });
    cs.setData(data.map(d => ({ time: d.tradingDate, open: +d.open, high: +d.high, low: +d.low, close: +d.close })));
    const vs = chart.addSeries(HistogramSeries, { color: '#2962ff', priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vs.setData(data.map(d => ({ time: d.tradingDate, value: d.volume, color: +d.close >= +d.open ? 'rgba(0,200,83,0.25)' : 'rgba(255,23,68,0.25)' })));
    chart.timeScale().fitContent();
  };

  // Helpers
  const fmt = (p) => p != null ? Number(p).toLocaleString('vi-VN') : '—';
  const fmtVol = (v) => { if (!v) return '0'; if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toLocaleString(); };
  const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN'); };
  const cls = (c) => c > 0 ? 'c-up' : c < 0 ? 'c-down' : 'c-ref';

  if (loading) return <div className="sd-page"><div className="sd-loading"><div className="spinner"></div>Đang tải...</div></div>;
  if (!stock) return <div className="sd-page"><div className="sd-loading">❌ Không tìm thấy: {ticker}<br/><button className="sd-btn" onClick={() => navigate('/stocks')}>← Quay lại</button></div></div>;

  const ceil = stock.referencePrice ? (+stock.referencePrice * 1.07).toFixed(0) : 0;
  const floor = stock.referencePrice ? (+stock.referencePrice * 0.93).toFixed(0) : 0;
  const totalBid = orderBook.bids?.reduce((s, b) => s + (b.totalQuantity || 0), 0) || 0;
  const totalAsk = orderBook.asks?.reduce((s, a) => s + (a.totalQuantity || 0), 0) || 0;
  const bidPct = totalBid + totalAsk > 0 ? (totalBid / (totalBid + totalAsk)) * 100 : 50;

  return (
    <div className="sd-page fade-in">
      {/* ===== HEADER ===== */}
      <div className="sd-header">
        <div className="sd-h-left">
          <button className="sd-back" onClick={() => navigate('/stocks')}>←</button>
          <span className="sd-ticker">{stock.ticker}</span>
          <span className={`sd-exch ex-${stock.exchange?.toLowerCase()}`}>{stock.exchange}</span>
          <span className="sd-comp">{stock.companyName}</span>
        </div>
        <div className="sd-h-price">
          <div className="sd-h-main-price">
            <span className={`sd-big-price ${cls(stock.change)}`}>{fmt(stock.currentPrice)}</span>
            <span className={`sd-chg ${cls(stock.change)}`}>
              {stock.change > 0 ? '+' : ''}{fmt(stock.change)}
            </span>
            <span className={`sd-chg-pct ${cls(stock.change)}`}>
              {stock.changePercent > 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
            </span>
          </div>
          <div className="sd-h-sub">
            MỞ CỬA/Trung bình: <span>{fmt(stock.openPrice)}/{fmt(stock.referencePrice)}</span>
            &nbsp;&nbsp;THẤP/CAO: <span>{fmt(stock.lowPrice)}/{fmt(stock.highPrice)}</span>
          </div>
        </div>
        <div className="sd-h-ceil-floor">
          <div className="sd-cf-item"><span className="sd-cf-label">Trần</span><span className="c-ceil">{fmt(ceil)}</span></div>
          <div className="sd-cf-item"><span className="sd-cf-label">Sàn</span><span className="c-floor">{fmt(floor)}</span></div>
          <div className="sd-cf-item"><span className="sd-cf-label">Tham chiếu</span><span className="c-ref">{fmt(stock.referencePrice)}</span></div>
        </div>
        <div className="sd-h-vol">
          TỔNG KL: <span className="c-vol">{fmtVol(stock.volume)}</span>
        </div>
        <div className="sd-h-actions">
          <button className="sd-btn-outline" onClick={() => navigate(`/stocks/${ticker}`)}>Phân tích cơ bản</button>
          <button className="sd-btn-primary" onClick={() => navigate(`/trading?ticker=${ticker}`)}>Đặt lệnh</button>
          <button className={`sd-watch ${isWatched ? 'on' : ''}`} onClick={toggleWatchlist} disabled={watchLoading}>
            {isWatched ? '★' : '☆'}
          </button>
          {connected && <span className="sd-live">●</span>}
        </div>
      </div>

      {/* ===== MAIN TABS ===== */}
      <div className="sd-main-tabs">
        {MAIN_TABS.map(t => (
          <button key={t} className={mainTab === t ? 'active' : ''} onClick={() => setMainTab(t)}>{t}</button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="sd-content">
        {/* ====== TAB: Giao dịch ====== */}
        {mainTab === 'Giao dịch' && (
          <div className="sd-trading-layout">
            <div className="sd-chart-area">
              <div className="sd-chart-info">
                <span>{stock.ticker} 1D {stock.exchange}</span>
                <span className="sd-ohlc">
                  O:{fmt(stock.openPrice)} H:{fmt(stock.highPrice)} L:{fmt(stock.lowPrice)} C:<span className={cls(stock.change)}>{fmt(stock.currentPrice)}</span>
                </span>
              </div>
              <div className="sd-chart-wrap" ref={chartContainerRef}></div>
              <div className="sd-range-bar">
                {RANGES.map(r => (
                  <button key={r} className={selectedRange === r ? 'active' : ''} onClick={() => setSelectedRange(r)}>{r}</button>
                ))}
              </div>
            </div>
            <div className="sd-right-col">
              {/* Order Book */}
              <div className="sd-ob-panel">
                <h4>Độ sâu thị trường</h4>
                <table className="sd-ob-table">
                  <thead><tr><th className="th-b">KL</th><th className="th-b">Giá mua</th><th className="th-s">Giá bán</th><th className="th-s">KL</th></tr></thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const bid = orderBook.bids?.[i]; const ask = orderBook.asks?.[i];
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
                <h4>Khớp lệnh</h4>
                <div className="sd-ml-head"><span>Thời gian</span><span>KL</span><span>Giá</span><span>+/-(%)</span></div>
                {orderBook.bids?.slice(0, 6).map((b, i) => (
                  <div className="sd-ml-row" key={`b${i}`}>
                    <span className="sd-ml-t">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span>{fmtVol(b.totalQuantity)}</span>
                    <span className="c-up">{fmt(b.price)}</span>
                    <span className="c-ref">{stock.changePercent?.toFixed(1)}</span>
                  </div>
                ))}
                {orderBook.asks?.slice(0, 6).map((a, i) => (
                  <div className="sd-ml-row" key={`a${i}`}>
                    <span className="sd-ml-t">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span>{fmtVol(a.totalQuantity)}</span>
                    <span className="c-down">{fmt(a.price)}</span>
                    <span className="c-ref">{stock.changePercent?.toFixed(1)}</span>
                  </div>
                ))}
                {!orderBook.bids?.length && !orderBook.asks?.length && <div className="sd-empty">Chưa có lệnh khớp</div>}
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB: Hồ sơ ====== */}
        {mainTab === 'Hồ sơ' && (
          <div className="sd-profile-layout">
            <div className="sd-profile-main">
              <div className="sd-profile-tabs">
                <button className="active">Giới thiệu</button>
                <button>TT niêm yết</button>
              </div>
              <div className="sd-profile-body">
                <h3>{stock.companyName}</h3>
                <p className="sd-profile-desc">
                  {stock.companyName} ({stock.ticker}) là công ty niêm yết trên sàn {stock.exchange}.
                  Mã cổ phiếu: <strong>{stock.ticker}</strong>. Sàn giao dịch: <strong>{stock.exchange}</strong>.
                </p>
                <div className="sd-profile-info-grid">
                  <div className="sd-pi"><span>Mã CK</span><span>{stock.ticker}</span></div>
                  <div className="sd-pi"><span>Sàn</span><span>{stock.exchange}</span></div>
                  <div className="sd-pi"><span>Giá hiện tại</span><span className={cls(stock.change)}>{fmt(stock.currentPrice)}</span></div>
                  <div className="sd-pi"><span>Giá tham chiếu</span><span className="c-ref">{fmt(stock.referencePrice)}</span></div>
                  <div className="sd-pi"><span>Khối lượng</span><span>{fmtVol(stock.volume)}</span></div>
                  <div className="sd-pi"><span>Trạng thái</span><span className={stock.isActive ? 'c-up' : 'c-down'}>{stock.isActive ? 'Đang giao dịch' : 'Tạm ngưng'}</span></div>
                </div>
              </div>
            </div>
            <div className="sd-profile-side">
              <h4>Cổ phiếu cùng ngành</h4>
              <div className="sd-same-list">
                {['VCB', 'TCB', 'MBB', 'BID', 'CTG', 'HPG', 'FPT', 'VNM'].filter(t => t !== ticker.toUpperCase()).slice(0, 6).map(t => (
                  <div className="sd-same-item" key={t} onClick={() => navigate(`/stocks/${t}`)}>
                    <span className="sd-same-ticker">{t}</span>
                    <span>→</span>
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
                {news.slice(0, 12).map((item, i) => (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="sd-news-card" key={i}>
                    <div className="sd-news-body">
                      <h4>{item.title}</h4>
                      <p>{item.description?.substring(0, 120)}...</p>
                      <span className="sd-news-date">{item.source} • {fmtDate(item.pubDate)}</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="sd-empty-big">📰 Chưa có tin tức. Hệ thống đang tải từ RSS feed...</div>
            )}
          </div>
        )}

        {/* ====== TAB: Thống kê ====== */}
        {mainTab === 'Thống kê' && (
          <div className="sd-stats-layout">
            <div className="sd-stats-tabs">
              <button className="active">Lịch sử giá</button>
            </div>
            <table className="sd-stats-table">
              <thead>
                <tr>
                  <th>Ngày GDKQ</th><th>Thay đổi</th><th>Đóng cửa</th>
                  <th>Khối lượng</th><th>Mở cửa</th><th>Cao nhất</th><th>Thấp nhất</th><th>Trung bình</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.slice().reverse().slice(0, 20).map((d, i) => {
                  const chg = (+d.close - +d.open).toFixed(0);
                  const chgPct = +d.open > 0 ? (((+d.close - +d.open) / +d.open) * 100).toFixed(2) : '0';
                  const avg = ((+d.high + +d.low) / 2).toFixed(0);
                  return (
                    <tr key={i}>
                      <td>{fmtDate(d.tradingDate)}</td>
                      <td>
                        <span className={+chg > 0 ? 'c-up' : +chg < 0 ? 'c-down' : ''}>
                          {+chg > 0 ? '↑' : +chg < 0 ? '↓' : '–'} {fmt(Math.abs(+chg))} ({chgPct}%)
                        </span>
                      </td>
                      <td>{fmt(d.close)}</td>
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
            {priceHistory.length === 0 && <div className="sd-empty-big">Đang tải lịch sử giá...</div>}
          </div>
        )}

        {/* ====== TAB: Tài chính ====== */}
        {mainTab === 'Tài chính' && (
          <div className="sd-fin-layout">
            <div className="sd-fin-main">
              <h4>Chỉ số kỹ thuật & Tài chính</h4>
              {indicators ? (
                <div className="sd-fin-grid">
                  <div className="sd-fin-section">
                    <h5>Định giá & Xu hướng</h5>
                    <div className="sd-fi"><span>RSI(14)</span><span className={indicators.rsi14 > 70 ? 'c-down' : indicators.rsi14 < 30 ? 'c-up' : 'c-ref'}>{indicators.rsi14?.toFixed(1)} {indicators.rsi14 > 70 ? '(Quá mua)' : indicators.rsi14 < 30 ? '(Quá bán)' : '(Trung tính)'}</span></div>
                    <div className="sd-fi"><span>MACD</span><span className={indicators.histogram > 0 ? 'c-up' : 'c-down'}>{indicators.macdLine?.toFixed(0)}</span></div>
                    <div className="sd-fi"><span>Signal Line</span><span>{indicators.signalLine?.toFixed(0)}</span></div>
                    <div className="sd-fi"><span>Histogram</span><span className={indicators.histogram > 0 ? 'c-up' : 'c-down'}>{indicators.histogram?.toFixed(0)}</span></div>
                  </div>
                  <div className="sd-fin-section">
                    <h5>Đường trung bình</h5>
                    <div className="sd-fi"><span>SMA(20)</span><span>{fmt(indicators.sma20)}</span></div>
                    <div className="sd-fi"><span>SMA(50)</span><span>{fmt(indicators.sma50)}</span></div>
                    <div className="sd-fi"><span>EMA(12)</span><span>{fmt(indicators.ema12)}</span></div>
                    <div className="sd-fi"><span>EMA(26)</span><span>{fmt(indicators.ema26)}</span></div>
                  </div>
                  <div className="sd-fin-section">
                    <h5>Bollinger Bands</h5>
                    <div className="sd-fi"><span>BB Upper</span><span className="c-up">{fmt(indicators.bollingerUpper)}</span></div>
                    <div className="sd-fi"><span>BB Middle</span><span className="c-ref">{fmt(indicators.bollingerMiddle)}</span></div>
                    <div className="sd-fi"><span>BB Lower</span><span className="c-down">{fmt(indicators.bollingerLower)}</span></div>
                  </div>
                  <div className="sd-fin-section">
                    <h5>Khối lượng & Biên độ</h5>
                    <div className="sd-fi"><span>KL hiện tại</span><span>{fmtVol(indicators.currentVolume)}</span></div>
                    <div className="sd-fi"><span>KL TB 20 phiên</span><span>{fmtVol(indicators.avgVolume20)}</span></div>
                    <div className="sd-fi"><span>Volume Ratio</span><span className={indicators.volumeRatio > 1.5 ? 'c-up' : ''}>{indicators.volumeRatio?.toFixed(2)}x</span></div>
                    <div className="sd-fi"><span>52 tuần cao nhất</span><span className="c-up">{fmt(indicators.weekHigh52)}</span></div>
                    <div className="sd-fi"><span>52 tuần thấp nhất</span><span className="c-down">{fmt(indicators.weekLow52)}</span></div>
                  </div>
                </div>
              ) : (
                <div className="sd-empty-big">Đang tải chỉ số kỹ thuật...</div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

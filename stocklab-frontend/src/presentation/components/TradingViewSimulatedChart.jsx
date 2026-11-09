import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  HistogramSeries,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';
import './TradingViewSimulatedChart.css';

const RANGES = ['1d', '5d', '1m', '3m', '6m', '1y', 'All'];

export default function TradingViewSimulatedChart({
  stock,
  priceHistory = [],
  selectedRange = '3m',
  onRangeChange,
  fullHeight = false,
  latestTrade = null,
}) {
  const workspaceRef = useRef(null);
  const chartViewportRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const livePriceLineRef = useRef(null);
  const lastCandleRef = useRef(null);
  const priceLinesRef = useRef([]);

  // Fast indicator maps for dynamic legend lookup
  const ma20MapRef = useRef(new Map());
  const ma50MapRef = useRef(new Map());
  const ema20MapRef = useRef(new Map());

  // Chart view states
  const [chartType, setChartType] = useState('candle'); // 'candle' | 'line' | 'area' | 'bar'
  const [crosshairMagnet, setCrosshairMagnet] = useState(false);
  const [showMeasure, setShowMeasure] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [livePulse, setLivePulse] = useState(false);

  // Active indicator toggles
  const [activeIndicators, setActiveIndicators] = useState({
    ma20: true,
    ma50: false,
    ema20: false,
    bb: false,
    volume: true,
  });

  // Dynamic Hover Legend state
  const [legendData, setLegendData] = useState(null);

  // Format utilities
  const fmt = (p) => (p != null ? Number(p).toLocaleString('vi-VN') : '—');
  const fmtVol = (v) => {
    if (!v) return '0';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toLocaleString();
  };
  const cls = (c) => (c > 0 ? 'c-up' : c < 0 ? 'c-down' : 'c-ref');

  // Technical Calculations
  const calculateSMA = (data, period) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += +data[i - j].close;
      }
      result.push({
        time: data[i].tradingDate,
        value: Math.round((sum / period) * 100) / 100,
      });
    }
    return result;
  };

  const calculateEMA = (data, period = 20) => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    const result = [];
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += +data[i].close;
    }
    let ema = sum / period;
    result.push({ time: data[period - 1].tradingDate, value: Math.round(ema * 100) / 100 });
    for (let i = period; i < data.length; i++) {
      ema = (+data[i].close) * k + ema * (1 - k);
      result.push({ time: data[i].tradingDate, value: Math.round(ema * 100) / 100 });
    }
    return result;
  };

  const calculateBollingerBands = (data, period = 20, multiplier = 2) => {
    const upper = [];
    const middle = [];
    const lower = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += +data[i - j].close;
      }
      const sma = sum / period;
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(+data[i - j].close - sma, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      const time = data[i].tradingDate;
      middle.push({ time, value: Math.round(sma * 100) / 100 });
      upper.push({ time, value: Math.round((sma + multiplier * stdDev) * 100) / 100 });
      lower.push({ time, value: Math.round((sma - multiplier * stdDev) * 100) / 100 });
    }
    return { upper, middle, lower };
  };

  // Render & Mount Chart
  const renderChart = useCallback(() => {
    if (!chartViewportRef.current || !priceHistory || !priceHistory.length) return;

    try {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      priceLinesRef.current = [];

      // Ensure unique and strictly ascending tradingDate for Lightweight Charts
      const dateMap = new Map();
      priceHistory.forEach((d) => {
        if (d && d.tradingDate && d.close != null) {
          dateMap.set(d.tradingDate, d);
        }
      });
      const sortedData = Array.from(dateMap.values()).sort(
        (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate)
      );

      // Ensure today's candle matches current stock price & volume
      const todayStr = new Date().toISOString().split('T')[0];
      if (stock && stock.currentPrice != null) {
        if (sortedData.length > 0) {
          const lastItem = sortedData[sortedData.length - 1];
          if (lastItem.tradingDate === todayStr) {
            lastItem.close = Number(stock.currentPrice);
            if (stock.highPrice != null) lastItem.high = Math.max(Number(lastItem.high), Number(stock.highPrice));
            if (stock.lowPrice != null) lastItem.low = Math.min(Number(lastItem.low), Number(stock.lowPrice));
            if (stock.volume != null) lastItem.volume = Math.max(Number(lastItem.volume || 0), Number(stock.volume));
          } else if (new Date(lastItem.tradingDate) < new Date(todayStr)) {
            sortedData.push({
              tradingDate: todayStr,
              open: Number(stock.openPrice ?? stock.referencePrice ?? stock.currentPrice),
              high: Number(stock.highPrice ?? stock.currentPrice),
              low: Number(stock.lowPrice ?? stock.currentPrice),
              close: Number(stock.currentPrice),
              volume: Number(stock.volume || 0),
            });
          }
        } else {
          sortedData.push({
            tradingDate: todayStr,
            open: Number(stock.openPrice ?? stock.referencePrice ?? stock.currentPrice),
            high: Number(stock.highPrice ?? stock.currentPrice),
            low: Number(stock.lowPrice ?? stock.currentPrice),
            close: Number(stock.currentPrice),
            volume: Number(stock.volume || 0),
          });
        }
      }

      if (!sortedData.length) return;

      const lastBar = sortedData[sortedData.length - 1];
      lastCandleRef.current = {
        time: lastBar.tradingDate,
        open: +(lastBar.open ?? lastBar.close),
        high: +(lastBar.high ?? lastBar.close),
        low: +(lastBar.low ?? lastBar.close),
        close: +lastBar.close,
        volume: Number(lastBar.volume || 0),
      };

      const container = chartViewportRef.current;
      const chart = createChart(container, {
        width: container.clientWidth || 600,
        height: container.clientHeight || (fullHeight ? 620 : 460),
        layout: {
          background: { color: '#ffffff' },
          textColor: '#64748b',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        },
        grid: {
          vertLines: { color: '#f1f5f9' },
          horzLines: { color: '#f1f5f9' },
        },
        crosshair: {
          mode: crosshairMagnet ? CrosshairMode.Magnet : CrosshairMode.Normal,
          vertLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed },
          horzLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: '#e2e8f0',
          scaleMargins: { top: 0.08, bottom: 0.22 },
        },
        timeScale: {
          borderColor: '#e2e8f0',
          timeVisible: false,
        },
      });
      chartRef.current = chart;

      // 1. Add Main Price Series based on chartType
      let mainSeries;
      if (chartType === 'line') {
        mainSeries = chart.addSeries(LineSeries, {
          color: '#2563eb',
          lineWidth: 2,
          title: 'Đường giá',
        });
        mainSeries.setData(sortedData.map(d => ({ time: d.tradingDate, value: +d.close })));
      } else if (chartType === 'area') {
        mainSeries = chart.addSeries(AreaSeries, {
          topColor: 'rgba(37, 99, 235, 0.28)',
          bottomColor: 'rgba(37, 99, 235, 0.02)',
          lineColor: '#2563eb',
          lineWidth: 2,
          title: 'Vùng giá',
        });
        mainSeries.setData(sortedData.map(d => ({ time: d.tradingDate, value: +d.close })));
      } else if (chartType === 'bar') {
        mainSeries = chart.addSeries(BarSeries, {
          upColor: '#059669',
          downColor: '#e11d48',
          title: 'Thanh OHLC',
        });
        mainSeries.setData(
          sortedData.map(d => ({
            time: d.tradingDate,
            open: +(d.open ?? d.close),
            high: +(d.high ?? d.close),
            low: +(d.low ?? d.close),
            close: +d.close,
          }))
        );
      } else {
        // Default: Candlestick
        mainSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#059669',
          downColor: '#e11d48',
          borderDownColor: '#e11d48',
          borderUpColor: '#059669',
          wickDownColor: '#e11d48',
          wickUpColor: '#059669',
          title: 'Nến Nhật',
        });
        mainSeries.setData(
          sortedData.map(d => ({
            time: d.tradingDate,
            open: +(d.open ?? d.close),
            high: +(d.high ?? d.close),
            low: +(d.low ?? d.close),
            close: +d.close,
          }))
        );
      }
      mainSeriesRef.current = mainSeries;

      // 2. Add MA20 Indicator
      if (activeIndicators.ma20 && sortedData.length >= 20) {
        const ma20 = calculateSMA(sortedData, 20);
        ma20MapRef.current = new Map(ma20.map(m => [m.time, m.value]));
        const ma20Series = chart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1.5,
          title: 'MA20',
          crosshairMarkerVisible: false,
        });
        ma20Series.setData(ma20);
      } else {
        ma20MapRef.current = new Map();
      }

      // 3. Add MA50 Indicator
      if (activeIndicators.ma50 && sortedData.length >= 50) {
        const ma50 = calculateSMA(sortedData, 50);
        ma50MapRef.current = new Map(ma50.map(m => [m.time, m.value]));
        const ma50Series = chart.addSeries(LineSeries, {
          color: '#8b5cf6',
          lineWidth: 1.5,
          title: 'MA50',
          crosshairMarkerVisible: false,
        });
        ma50Series.setData(ma50);
      } else {
        ma50MapRef.current = new Map();
      }

      // 4. Add EMA20 Indicator
      if (activeIndicators.ema20 && sortedData.length >= 20) {
        const ema20 = calculateEMA(sortedData, 20);
        ema20MapRef.current = new Map(ema20.map(m => [m.time, m.value]));
        const ema20Series = chart.addSeries(LineSeries, {
          color: '#06b6d4',
          lineWidth: 1.5,
          title: 'EMA20',
          crosshairMarkerVisible: false,
        });
        ema20Series.setData(ema20);
      } else {
        ema20MapRef.current = new Map();
      }

      // 5. Add Bollinger Bands
      if (activeIndicators.bb && sortedData.length >= 20) {
        const bb = calculateBollingerBands(sortedData, 20, 2);
        const bbUp = chart.addSeries(LineSeries, {
          color: 'rgba(2, 132, 199, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          crosshairMarkerVisible: false,
        });
        bbUp.setData(bb.upper);

        const bbMid = chart.addSeries(LineSeries, {
          color: 'rgba(100, 116, 139, 0.6)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          crosshairMarkerVisible: false,
        });
        bbMid.setData(bb.middle);

        const bbLow = chart.addSeries(LineSeries, {
          color: 'rgba(2, 132, 199, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          crosshairMarkerVisible: false,
        });
        bbLow.setData(bb.lower);
      }

      // 6. Add Volume Histogram
      if (activeIndicators.volume) {
        const vs = chart.addSeries(HistogramSeries, {
          color: '#090d16',
          priceFormat: { type: 'volume' },
          priceScaleId: 'vol',
        });
        chart.priceScale('vol').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        vs.setData(
          sortedData.map(d => ({
            time: d.tradingDate,
            value: d.volume,
            color: +d.close >= +(d.open ?? d.close) ? 'rgba(5, 150, 105, 0.25)' : 'rgba(225, 29, 72, 0.25)',
          }))
        );
        volumeSeriesRef.current = vs;
      } else {
        volumeSeriesRef.current = null;
      }

      // 7. Add Live Price Line
      if (stock && stock.currentPrice != null) {
        try {
          livePriceLineRef.current = mainSeries.createPriceLine({
            price: Number(stock.currentPrice),
            color: '#2563eb',
            lineWidth: 1.5,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `Khớp: ${fmt(stock.currentPrice)}`,
          });
        } catch {}
      }

      // 8. Subscribe to Crosshair Movement for Dynamic Legend
      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time || !param.seriesData) {
          setLegendData(null);
          return;
        }
        const val = param.seriesData.get(mainSeries);
        if (!val) {
          setLegendData(null);
          return;
        }
        const time = param.time;
        const open = val.open ?? val.value;
        const high = val.high ?? val.value;
        const low = val.low ?? val.value;
        const close = val.close ?? val.value;
        const change = open ? close - open : 0;
        const changePct = open ? ((close - open) / open) * 100 : 0;

        const item = sortedData.find(d => d.tradingDate === time);
        const volume = item ? item.volume : null;

        setLegendData({
          time,
          open,
          high,
          low,
          close,
          change,
          changePct,
          volume,
          ma20: ma20MapRef.current.get(time),
          ma50: ma50MapRef.current.get(time),
          ema20: ema20MapRef.current.get(time),
        });
      });

      chart.timeScale().fitContent();
    } catch (err) {
      console.error('Lỗi khởi tạo biểu đồ:', err);
    }
  }, [priceHistory, chartType, activeIndicators, crosshairMagnet, fullHeight, stock?.ticker]);

  // Re-render chart when data or options change
  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // 🚀 REAL-TIME TICK HANDLER: Cập nhật biến động theo giao dịch mới mà không re-render canvas
  useEffect(() => {
    if (!mainSeriesRef.current || !lastCandleRef.current) return;

    const newPrice = Number(latestTrade?.price ?? stock?.currentPrice);
    if (!newPrice || isNaN(newPrice)) return;

    const prev = lastCandleRef.current;
    const newHigh = Math.max(prev.high, newPrice);
    const newLow = Math.min(prev.low, newPrice);
    const newClose = newPrice;
    const addedVol = Number(latestTrade?.quantity || 0);
    const newVolume = Number(stock?.volume ?? (prev.volume + addedVol));

    const updated = {
      time: prev.time,
      open: prev.open,
      high: newHigh,
      low: newLow,
      close: newClose,
      volume: newVolume,
    };
    lastCandleRef.current = updated;

    // Update Main Series smoothly
    try {
      if (chartType === 'line' || chartType === 'area') {
        mainSeriesRef.current.update({
          time: updated.time,
          value: updated.close,
        });
      } else {
        mainSeriesRef.current.update({
          time: updated.time,
          open: updated.open,
          high: updated.high,
          low: updated.low,
          close: updated.close,
        });
      }
    } catch (err) {
      console.warn('Lỗi cập nhật main series tick:', err);
    }

    // Update Volume Histogram Series smoothly
    if (volumeSeriesRef.current && activeIndicators.volume) {
      try {
        volumeSeriesRef.current.update({
          time: updated.time,
          value: updated.volume,
          color: updated.close >= updated.open ? 'rgba(5, 150, 105, 0.25)' : 'rgba(225, 29, 72, 0.25)',
        });
      } catch (err) {
        console.warn('Lỗi cập nhật volume series tick:', err);
      }
    }

    // Update Live Price Line on chart
    if (livePriceLineRef.current) {
      try {
        livePriceLineRef.current.applyOptions({
          price: updated.close,
          title: `Khớp: ${fmt(updated.close)}`,
        });
      } catch {}
    }

    // Trigger visual pulse for real-time trade feedback
    setLivePulse(true);
    const t = setTimeout(() => setLivePulse(false), 500);
    return () => clearTimeout(t);
  }, [
    stock?.currentPrice,
    stock?.volume,
    stock?.highPrice,
    stock?.lowPrice,
    latestTrade,
    chartType,
    activeIndicators.volume,
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // ResizeObserver for auto-fit dimensions
  useEffect(() => {
    if (!chartViewportRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || !entries[0] || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chartRef.current.applyOptions({ width, height });
      }
    });
    observer.observe(chartViewportRef.current);
    return () => observer.disconnect();
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        if (chartRef.current) chartRef.current.timeScale().fitContent();
      }, 150);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Drawing Tools
  const addResistanceLine = () => {
    if (!mainSeriesRef.current || !priceHistory.length) return;
    const maxHigh = Math.max(...priceHistory.map(d => +d.high || +d.close));
    const line = mainSeriesRef.current.createPriceLine({
      price: maxHigh,
      color: '#e11d48',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `Kháng cự: ${fmt(maxHigh)}`,
    });
    priceLinesRef.current.push(line);
    setLineCount(prev => prev + 1);
  };

  const addSupportLine = () => {
    if (!mainSeriesRef.current || !priceHistory.length) return;
    const minLow = Math.min(...priceHistory.map(d => +d.low || +d.close));
    const line = mainSeriesRef.current.createPriceLine({
      price: minLow,
      color: '#059669',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `Hỗ trợ: ${fmt(minLow)}`,
    });
    priceLinesRef.current.push(line);
    setLineCount(prev => prev + 1);
  };

  const addCurrentPriceLine = () => {
    if (!mainSeriesRef.current || !stock) return;
    const cur = stock.currentPrice;
    const line = mainSeriesRef.current.createPriceLine({
      price: cur,
      color: '#2563eb',
      lineWidth: 1.5,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: `Giá HT: ${fmt(cur)}`,
    });
    priceLinesRef.current.push(line);
    setLineCount(prev => prev + 1);
  };

  const clearAllLines = () => {
    if (!mainSeriesRef.current) return;
    priceLinesRef.current.forEach((line) => {
      try {
        mainSeriesRef.current.removePriceLine(line);
      } catch {}
    });
    priceLinesRef.current = [];
    setLineCount(0);
  };

  const toggleCrosshairMode = () => {
    const next = !crosshairMagnet;
    setCrosshairMagnet(next);
    if (chartRef.current) {
      chartRef.current.applyOptions({
        crosshair: {
          mode: next ? CrosshairMode.Magnet : CrosshairMode.Normal,
        },
      });
    }
  };

  // Utilities
  const handleFitContent = () => {
    if (chartRef.current) chartRef.current.timeScale().fitContent();
  };

  const takeSnapshot = () => {
    try {
      const canvas =
        chartRef.current?.takeScreenshot?.() ||
        chartViewportRef.current?.querySelector('canvas');
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = `${stock?.ticker || 'chart'}_${selectedRange}_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Lỗi chụp ảnh biểu đồ:', err);
    }
  };

  const toggleFullscreen = () => {
    if (!workspaceRef.current) return;
    if (!document.fullscreenElement) {
      workspaceRef.current.requestFullscreen?.().then(() => {
        setIsFullscreen(true);
        setTimeout(() => chartRef.current?.timeScale().fitContent(), 100);
      }).catch(err => console.error('Lỗi fullscreen:', err));
    } else {
      document.exitFullscreen?.().then(() => {
        setIsFullscreen(false);
        setTimeout(() => chartRef.current?.timeScale().fitContent(), 100);
      });
    }
  };

  // Measurement stats (derived from priceHistory)
  const measureStats = React.useMemo(() => {
    if (!priceHistory.length) return null;
    const highs = priceHistory.map(d => +d.high || +d.close);
    const lows = priceHistory.map(d => +d.low || +d.close);
    const maxP = Math.max(...highs);
    const minP = Math.min(...lows);
    const diff = maxP - minP;
    const pct = minP > 0 ? (diff / minP) * 100 : 0;
    const totalVol = priceHistory.reduce((s, d) => s + (d.volume || 0), 0);
    const avgVol = Math.round(totalVol / priceHistory.length);
    return {
      maxPrice: maxP,
      minPrice: minP,
      diff,
      pct,
      sessions: priceHistory.length,
      avgVol,
    };
  }, [priceHistory]);

  return (
    <div
      className={`tv-workspace ${isFullscreen ? 'tv-fullscreen' : ''}`}
      ref={workspaceRef}
      style={{ height: fullHeight ? '100%' : undefined }}
    >
      {/* 1. TOP TOOLBAR (TradingView Style) */}
      <div className="tv-top-toolbar">
        <div className="tv-tb-left">
          {/* Symbol info */}
          <div className="tv-symbol-badge">
            <span className="tv-sym-ticker">{stock?.ticker || 'TICKER'}</span>
            <span className="tv-sym-exch">{stock?.exchange || 'HOSE'}</span>
          </div>

          {/* Chart Style Switcher */}
          <div className="tv-btn-group" title="Kiểu hiển thị đồ thị">
            <button
              className={`tv-seg-btn ${chartType === 'candle' ? 'active' : ''}`}
              onClick={() => setChartType('candle')}
            >
              Nến Nhật
            </button>
            <button
              className={`tv-seg-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
            >
              Đường Line
            </button>
            <button
              className={`tv-seg-btn ${chartType === 'area' ? 'active' : ''}`}
              onClick={() => setChartType('area')}
            >
              Vùng Area
            </button>
            <button
              className={`tv-seg-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
            >
              Thanh Bar
            </button>
          </div>

          {/* Indicator Quick Toggles */}
          <div className="tv-ind-group">
            <button
              className={`tv-ind-pill ${activeIndicators.ma20 ? 'active' : ''}`}
              onClick={() => setActiveIndicators(prev => ({ ...prev, ma20: !prev.ma20 }))}
              title="Đường trung bình MA20"
            >
              <span className="tv-ind-dot dot-ma20"></span>
              MA20
            </button>
            <button
              className={`tv-ind-pill ${activeIndicators.ma50 ? 'active' : ''}`}
              onClick={() => setActiveIndicators(prev => ({ ...prev, ma50: !prev.ma50 }))}
              title="Đường trung bình MA50"
            >
              <span className="tv-ind-dot dot-ma50"></span>
              MA50
            </button>
            <button
              className={`tv-ind-pill ${activeIndicators.ema20 ? 'active' : ''}`}
              onClick={() => setActiveIndicators(prev => ({ ...prev, ema20: !prev.ema20 }))}
              title="Đường lũy thừa EMA20"
            >
              <span className="tv-ind-dot dot-ema20"></span>
              EMA20
            </button>
            <button
              className={`tv-ind-pill ${activeIndicators.bb ? 'active' : ''}`}
              onClick={() => setActiveIndicators(prev => ({ ...prev, bb: !prev.bb }))}
              title="Dải Bollinger Bands"
            >
              <span className="tv-ind-dot dot-bb"></span>
              Bollinger
            </button>
            <button
              className={`tv-ind-pill ${activeIndicators.volume ? 'active' : ''}`}
              onClick={() => setActiveIndicators(prev => ({ ...prev, volume: !prev.volume }))}
              title="Cột Khối lượng"
            >
              <span className="tv-ind-dot dot-vol"></span>
              Khối lượng
            </button>
          </div>
        </div>

        <div className="tv-tb-right">
          <button className="tv-tool-btn" onClick={handleFitContent} title="Căn vừa vặn đồ thị">
            Căn vừa
          </button>
          <button className="tv-tool-btn" onClick={takeSnapshot} title="Lưu ảnh biểu đồ (PNG)">
            Chụp ảnh
          </button>
          <button className="tv-tool-btn" onClick={toggleFullscreen} title="Bật/Tắt chế độ toàn màn hình">
            {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC CURSOR LEGEND BAR */}
      <div className="tv-legend-bar">
        <div className="tv-legend-ohlc">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <strong>{stock?.ticker}</strong> · 1D
            <span
              className={`tv-live-indicator ${livePulse ? 'pulse' : ''}`}
              title="Đang đồng bộ lệnh khớp thời gian thực"
            >
              LIVE
            </span>
          </span>
          <span>O: <strong>{fmt(legendData ? legendData.open : (lastCandleRef.current?.open ?? stock?.openPrice))}</strong></span>
          <span>H: <strong>{fmt(legendData ? legendData.high : (lastCandleRef.current?.high ?? stock?.highPrice))}</strong></span>
          <span>L: <strong>{fmt(legendData ? legendData.low : (lastCandleRef.current?.low ?? stock?.lowPrice))}</strong></span>
          <span>
            C: <strong className={cls(legendData ? legendData.change : stock?.change)}>
              {fmt(legendData ? legendData.close : (lastCandleRef.current?.close ?? stock?.currentPrice))}
            </strong>
          </span>
          {legendData ? (
            <span className={cls(legendData.change)}>
              ({legendData.changePct > 0 ? '+' : ''}{legendData.changePct.toFixed(2)}%)
            </span>
          ) : stock?.changePercent != null ? (
            <span className={cls(stock.change)}>
              ({stock.changePercent > 0 ? '+' : ''}{Number(stock.changePercent).toFixed(2)}%)
            </span>
          ) : null}
        </div>

        <div className="tv-legend-inds">
          {activeIndicators.ma20 && (
            <span className="ind-ma20">MA20: {legendData?.ma20 ? fmt(legendData.ma20) : '—'}</span>
          )}
          {activeIndicators.ma50 && (
            <span className="ind-ma50">MA50: {legendData?.ma50 ? fmt(legendData.ma50) : '—'}</span>
          )}
          {activeIndicators.ema20 && (
            <span className="ind-ema20">EMA20: {legendData?.ema20 ? fmt(legendData.ema20) : '—'}</span>
          )}
          {activeIndicators.volume && (
            <span>VOL: {fmtVol(legendData ? legendData.volume : stock?.volume)}</span>
          )}
        </div>
      </div>

      {/* 3. MEASURE BANNER (When active) */}
      {showMeasure && measureStats && (
        <div className="tv-measure-banner">
          <div className="tv-mb-items">
            <span>Thước đo: <strong>{selectedRange.toUpperCase()}</strong> ({measureStats.sessions} phiên)</span>
            <span>Đáy: <strong>{fmt(measureStats.minPrice)} đ</strong></span>
            <span>Đỉnh: <strong>{fmt(measureStats.maxPrice)} đ</strong></span>
            <span>Biên độ: <strong className="c-up">+{fmt(measureStats.diff)} đ (+{measureStats.pct.toFixed(2)}%)</strong></span>
            <span>KL bình quân: <strong>{fmtVol(measureStats.avgVol)} CP/phiên</strong></span>
          </div>
          <button className="tv-mb-close" onClick={() => setShowMeasure(false)}>
            Đóng thước
          </button>
        </div>
      )}

      {/* 4. MAIN BODY: LEFT DRAWING RAIL + CHART VIEWPORT */}
      <div className="tv-body-layout">
        {/* Left Drawing & Analysis Rail (TradingView Trademark) */}
        <div className="tv-left-rail">
          <button
            className={`tv-rail-btn ${crosshairMagnet ? 'active' : ''}`}
            onClick={toggleCrosshairMode}
            title={crosshairMagnet ? 'Con trỏ: Bắt dính giá (Magnet)' : 'Con trỏ: Tự do (Normal)'}
          >
            <span className="tv-rail-badge">{crosshairMagnet ? 'MAG' : 'CRS'}</span>
          </button>

          <div className="tv-rail-divider"></div>

          <button
            className="tv-rail-btn"
            onClick={addResistanceLine}
            title="Kẻ đường kháng cự tại đỉnh cao nhất"
          >
            <span className="tv-rail-badge" style={{ color: '#e11d48' }}>+R</span>
          </button>

          <button
            className="tv-rail-btn"
            onClick={addSupportLine}
            title="Kẻ đường hỗ trợ tại đáy thấp nhất"
          >
            <span className="tv-rail-badge" style={{ color: '#059669' }}>+S</span>
          </button>

          <button
            className="tv-rail-btn"
            onClick={addCurrentPriceLine}
            title="Kẻ mức giá thị trường hiện tại"
          >
            <span className="tv-rail-badge" style={{ color: '#2563eb' }}>+P</span>
          </button>

          <div className="tv-rail-divider"></div>

          <button
            className={`tv-rail-btn ${showMeasure ? 'active' : ''}`}
            onClick={() => setShowMeasure(prev => !prev)}
            title="Thước đo biên độ & biến động giá"
          >
            <span className="tv-rail-badge">ĐO</span>
          </button>

          <button
            className="tv-rail-btn btn-danger"
            onClick={clearAllLines}
            title="Xóa tất cả các đường vẽ kỹ thuật"
            style={{ width: lineCount > 0 ? '42px' : '34px' }}
          >
            <span className="tv-rail-badge">{lineCount > 0 ? `XÓA (${lineCount})` : 'XÓA'}</span>
          </button>
        </div>

        {/* Chart Viewport */}
        <div className="tv-chart-viewport" ref={chartViewportRef}>
          {priceHistory.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.82rem', background: 'rgba(255,255,255,0.85)', zIndex: 10 }}>
              Đang đồng bộ dữ liệu mô phỏng {stock?.ticker}...
            </div>
          )}
        </div>
      </div>

      {/* 5. BOTTOM TIMEFRAME BAR */}
      <div className="tv-bottom-bar">
        <div className="tv-range-list">
          {RANGES.map((r) => (
            <button
              key={r}
              className={`tv-range-btn ${selectedRange === r ? 'active' : ''}`}
              onClick={() => onRangeChange?.(r)}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="tv-status-live">
          <span className={`tv-live-pulse ${livePulse ? 'pulse' : ''}`}></span>
          <span>{livePulse ? 'Đang nhận lệnh khớp thời gian thực...' : 'Dữ liệu mô phỏng sàn StockLab'}</span>
        </div>
      </div>
    </div>
  );
}

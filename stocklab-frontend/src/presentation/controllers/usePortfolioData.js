import { useState, useEffect, useCallback, useMemo } from 'react';
import { tradeAPI, userAPI, customPortfolioAPI } from '@/infrastructure/repositories/api';
import { useBatchWebSocket } from './useBatchWebSocket';

export function usePortfolioData({ lastResyncTime }) {
  const [portfolio, setPortfolio] = useState([]);
  const [summary, setSummary] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Multi-portfolio
  const [customPortfolios, setCustomPortfolios] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or custom portfolio ID
  const [customSummary, setCustomSummary] = useState(null);
  const [loadingCustomSummary, setLoadingCustomSummary] = useState(false);

  const fetchCustomSummary = useCallback(async (portfolioId) => {
    const token = localStorage.getItem('token');
    if (!token || !portfolioId) return;

    setLoadingCustomSummary(true);
    try {
      const res = await customPortfolioAPI.getSummary(portfolioId);
      if (res.data.success) {
        setCustomSummary(res.data.data);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Lỗi tải tóm tắt danh mục tùy chỉnh:', err);
      }
    } finally {
      setLoadingCustomSummary(false);
    }
  }, []);

  const refreshCustomPortfolios = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await customPortfolioAPI.getAll();
      if (res.data.success) {
        setCustomPortfolios(res.data.data || []);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Lỗi tải danh mục tùy chỉnh:', err);
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setPortfolio([]);
      setBalance(0);
      setSummary(null);
      setCustomPortfolios([]);
      return;
    }

    setLoading(true);
    try {
      const [portfolioRes, profileRes, summaryRes, customRes] = await Promise.all([
        tradeAPI.getPortfolio().catch((err) => {
          if (err.response?.status !== 401) console.warn('Lỗi getPortfolio:', err);
          return { data: { success: false, data: [] } };
        }),
        userAPI.getProfile().catch((err) => {
          if (err.response?.status !== 401) console.warn('Lỗi getProfile:', err);
          return { data: { success: false, data: { balance: 0 } } };
        }),
        tradeAPI.getPortfolioSummary().catch((err) => {
          if (err.response?.status !== 401) console.warn('Lỗi getPortfolioSummary:', err);
          return { data: { success: false, data: null } };
        }),
        customPortfolioAPI.getAll().catch((err) => {
          if (err.response?.status !== 401) console.warn('Lỗi getCustomPortfolios:', err);
          return { data: { success: false, data: [] } };
        }),
      ]);

      if (portfolioRes.data.success) setPortfolio(portfolioRes.data.data || []);
      if (profileRes.data.success) setBalance(profileRes.data.data.balance || 0);
      if (summaryRes.data.success && summaryRes.data.data) setSummary(summaryRes.data.data);
      if (customRes.data.success) setCustomPortfolios(customRes.data.data || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu danh mục:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [lastResyncTime, fetchData]);

  useEffect(() => {
    if (activeTab !== 'all') {
      fetchCustomSummary(activeTab);
    } else {
      setCustomSummary(null);
    }
  }, [activeTab, fetchCustomSummary]);

  useBatchWebSocket('/user/queue/portfolio', (batches) => {
    if (batches.length > 0) {
      const latest = batches[batches.length - 1];
      setPortfolio(latest.portfolios || []);
      tradeAPI.getPortfolioSummary().then((res) => {
        if (res.data.success) setSummary(res.data.data);
      }).catch(console.error);

      if (activeTab !== 'all') {
        fetchCustomSummary(activeTab);
      }
    }
  });

  useBatchWebSocket('/user/queue/balance', (batches) => {
    if (batches.length > 0) {
      const latest = batches[batches.length - 1];
      setBalance(latest.balance);
    }
  });

  const isAll = activeTab === 'all';
  const activeCustom = useMemo(
    () => (!isAll ? customPortfolios.find((cp) => cp.id === activeTab) : null),
    [isAll, customPortfolios, activeTab]
  );

  // Fallback calculation directly from holdings list if backend summary is still loading
  const calculatedFallback = useMemo(() => {
    const totalVal = portfolio.reduce((sum, p) => sum + Number(p.totalValue || 0), 0);
    const totalInv = portfolio.reduce(
      (sum, p) => sum + Number(p.avgBuyPrice || 0) * Number(p.quantity || 0),
      0
    );
    const pnl = portfolio.reduce((sum, p) => sum + Number(p.profitLoss || 0), 0);
    const pnlPct = totalInv > 0 ? (pnl / totalInv) * 100 : 0;
    const assets = totalVal + Number(balance || 0);

    const chartColors = [
      '#2962ff', '#00c853', '#ff6d00', '#aa00ff', '#d50000',
      '#00bfa5', '#6200ea', '#c51162', '#0091ea', '#64dd17',
    ];
    const allocs = portfolio.map((p, idx) => ({
      ticker: p.ticker,
      companyName: p.companyName,
      value: p.totalValue,
      percentage: totalVal > 0 ? (Number(p.totalValue || 0) / totalVal) * 100 : 0,
      color: chartColors[idx % chartColors.length],
    }));

    return {
      totalStockValue: totalVal,
      totalInvested: totalInv,
      totalPnL: pnl,
      totalPnLPercent: pnlPct,
      totalAssets: assets,
      allocations: allocs,
    };
  }, [portfolio, balance]);

  // Clean Architecture: Prioritize backend summary (Single Source of Truth), fallback to calculated
  const currentHoldings = isAll ? portfolio : (customSummary?.holdings || []);
  const currentTotalValue = isAll
    ? Number(summary?.totalStockValue ?? calculatedFallback.totalStockValue)
    : Number(customSummary?.totalStockValue ?? 0);
  const currentTotalInvested = isAll
    ? Number(summary?.totalInvested ?? calculatedFallback.totalInvested)
    : Number(customSummary?.totalInvested ?? 0);
  const currentTotalPnL = isAll
    ? Number(summary?.totalPnL ?? calculatedFallback.totalPnL)
    : Number(customSummary?.totalPnL ?? 0);
  const currentTotalPnLPercent = isAll
    ? Number(summary?.totalPnLPercent ?? calculatedFallback.totalPnLPercent)
    : Number(customSummary?.totalPnLPercent ?? 0);
  const currentTotalAssets = isAll
    ? Number(summary?.totalAssets ?? calculatedFallback.totalAssets)
    : currentTotalValue;
  const currentAllocations = isAll
    ? (summary?.allocations && summary.allocations.length > 0 ? summary.allocations : calculatedFallback.allocations)
    : (customSummary?.allocations || []);

  return {
    portfolio,
    summary,
    balance,
    loading,
    customPortfolios,
    activeTab,
    setActiveTab,
    activeCustom,
    isAll,
    customSummary,
    loadingCustomSummary,
    baseMetrics: {
      totalValue: currentTotalValue,
      totalInvested: currentTotalInvested,
      totalPnL: currentTotalPnL,
      totalPnLPercent: currentTotalPnLPercent,
      totalAssets: currentTotalAssets,
    },
    currentHoldings,
    currentTotalValue,
    currentTotalInvested,
    currentTotalPnL,
    currentTotalPnLPercent,
    currentAllocations,
    fetchData,
    refreshCustomPortfolios,
    fetchCustomSummary,
  };
}

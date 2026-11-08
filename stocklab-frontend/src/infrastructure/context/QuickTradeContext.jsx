import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userAPI, stockAPI, tradeAPI } from '@/infrastructure/repositories/api';

const QuickTradeContext = createContext(null);

export function QuickTradeProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Form State
  const [ticker, setTicker] = useState('FPT');
  const [side, setSide] = useState('BUY'); // 'BUY' | 'SELL'
  const [orderType, setOrderType] = useState('LIMIT'); // 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO' | 'SL_TP'
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  // Conditional Specific Fields
  const [stopPrice, setStopPrice] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [trailingType, setTrailingType] = useState('PERCENT'); // 'PERCENT' | 'AMOUNT'
  const [trailingAmount, setTrailingAmount] = useState('');
  const [ocoPrice1, setOcoPrice1] = useState('');
  const [ocoPrice2, setOcoPrice2] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Stock details
  const [stockInfo, setStockInfo] = useState(null);
  const [holdingQuantity, setHoldingQuantity] = useState(0);

  // Financial Balances
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Refresh user balance (Chỉ gọi khi có token đăng nhập)
  const refreshBalance = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setBalance(0);
      setLockedBalance(0);
      return;
    }
    try {
      setBalanceLoading(true);
      const res = await userAPI.getProfile();
      if (res.data.success) {
        setBalance(res.data.data.balance || 0);
        setLockedBalance(res.data.data.lockedBalance || 0);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('QuickTradeContext: Lỗi cập nhật số dư:', err);
      }
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // Fetch stock quote and user holdings for current ticker
  const refreshStockAndHoldings = useCallback(async (symbol) => {
    if (!symbol) return;
    try {
      const sRes = await stockAPI.getByTicker(symbol);
      if (sRes.data.success) {
        const info = sRes.data.data;
        setStockInfo(info);
        if (!price || price === '0') {
          setPrice(String(info.currentPrice || info.referencePrice || ''));
        }
      }
    } catch {
      // Stock not found or network issue
    }

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const pRes = await tradeAPI.getPortfolio();
        if (pRes.data.success && Array.isArray(pRes.data.data)) {
          const item = pRes.data.data.find(h => h.ticker === symbol);
          setHoldingQuantity(item ? item.quantity : 0);
        }
      } catch {
        setHoldingQuantity(0);
      }
    } else {
      setHoldingQuantity(0);
    }
  }, [price]);

  // Initial balance and dates
  useEffect(() => {
    refreshBalance();
    const now = new Date();
    setEffectiveDate(now.toISOString().slice(0, 10));
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 30);
    setExpiryDate(expiry.toISOString().slice(0, 16));
  }, [refreshBalance]);

  // Trigger stock details load when ticker changes
  useEffect(() => {
    if (isOpen && ticker) {
      refreshStockAndHoldings(ticker);
    }
  }, [isOpen, ticker, refreshStockAndHoldings]);

  // Global Action: Open Quick Trade with smart pre-filled context
  const openTrade = useCallback((prefill = {}) => {
    if (prefill.ticker) {
      setTicker(prefill.ticker.toUpperCase());
    }
    if (prefill.side) {
      setSide(prefill.side.toUpperCase());
    }
    if (prefill.orderType) {
      setOrderType(prefill.orderType.toUpperCase());
    }
    if (prefill.price !== undefined && prefill.price !== null) {
      setPrice(String(prefill.price));
    }
    if (prefill.quantity !== undefined && prefill.quantity !== null) {
      setQuantity(String(prefill.quantity));
    }
    setIsOpen(true);
    setIsMinimized(false);
    refreshBalance();
  }, [refreshBalance]);

  const closeTrade = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const minimizeTrade = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const maximizeTrade = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const availableBalance = Math.max(0, balance - lockedBalance);

  const value = {
    isOpen,
    isMinimized,
    ticker,
    setTicker,
    side,
    setSide,
    orderType,
    setOrderType,
    price,
    setPrice,
    quantity,
    setQuantity,
    stopPrice,
    setStopPrice,
    limitPrice,
    setLimitPrice,
    trailingType,
    setTrailingType,
    trailingAmount,
    setTrailingAmount,
    ocoPrice1,
    setOcoPrice1,
    ocoPrice2,
    setOcoPrice2,
    stopLossPrice,
    setStopLossPrice,
    takeProfitPrice,
    setTakeProfitPrice,
    effectiveDate,
    setEffectiveDate,
    expiryDate,
    setExpiryDate,
    stockInfo,
    holdingQuantity,
    balance,
    lockedBalance,
    availableBalance,
    balanceLoading,
    refreshBalance,
    refreshStockAndHoldings,
    openTrade,
    closeTrade,
    minimizeTrade,
    maximizeTrade,
  };

  return (
    <QuickTradeContext.Provider value={value}>
      {children}
    </QuickTradeContext.Provider>
  );
}

export function useQuickTrade() {
  const context = useContext(QuickTradeContext);
  if (!context) {
    throw new Error('useQuickTrade must be used within a QuickTradeProvider');
  }
  return context;
}

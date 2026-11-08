import { useState, useEffect, useCallback } from 'react';
import { stockAPI, orderAPI, otpAPI } from '@/infrastructure/repositories/api';
import { useWebSocket as useStompWebSocket } from './useWebSocket';

export function useTradingForm({ availableBalance, portfolio, onOrderSuccess }) {
  const [activeTab, setActiveTab] = useState('BUY'); // 'BUY' | 'SELL'
  const [orderType, setOrderType] = useState('LIMIT'); // 'LIMIT' | 'MARKET'
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [tradeStep, setTradeStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Backend Estimate State (Single Source of Truth for Calculations)
  const [estimate, setEstimate] = useState(null);

  // Live price updates via WebSocket
  useStompWebSocket('/topic/prices', (prices) => {
    if (selectedStock && Array.isArray(prices)) {
      const live = prices.find((p) => p.ticker === selectedStock.ticker);
      if (live && live.currentPrice !== selectedStock.currentPrice) {
        setSelectedStock((prev) => (prev ? { ...prev, currentPrice: live.currentPrice } : prev));
      }
    }
  });

  // Debounced search for BUY mode
  useEffect(() => {
    if (activeTab === 'BUY' && ticker.length >= 1) {
      const timer = setTimeout(async () => {
        try {
          const res = await stockAPI.search(ticker);
          if (res.data.success) {
            setSearchResults(res.data.data);
            setShowDropdown(true);
          }
        } catch (err) {
          console.error('Lỗi tìm kiếm:', err);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [ticker, activeTab]);

  // Clean Architecture: Delegate estimation & valuation to Backend
  useEffect(() => {
    const currentTicker = selectedStock?.ticker || ticker;
    if (!currentTicker || !quantity || Number(quantity) <= 0) {
      setEstimate(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const payload = {
          ticker: currentTicker,
          side: activeTab,
          orderType: orderType === 'LIMIT' ? 'LO' : 'MP',
          quantity: Number(quantity),
        };
        if (orderType === 'LIMIT' && price && Number(price) > 0) {
          payload.price = Number(price);
        }
        const res = await orderAPI.estimateOrder(payload);
        if (res.data.success) {
          setEstimate(res.data.data);
        }
      } catch (err) {
        console.error('Lỗi ước tính giá trị lệnh từ backend:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedStock, ticker, quantity, price, orderType, activeTab]);

  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setTicker(stock.ticker);
    setPrice(String(stock.currentPrice));
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleSelectPortfolioStock = (item) => {
    setSelectedStock({
      ticker: item.ticker,
      companyName: item.companyName,
      currentPrice: item.currentPrice,
      exchange: item.exchange,
    });
    setTicker(item.ticker);
    setPrice(String(item.currentPrice));
  };

  const resetForm = () => {
    setSelectedStock(null);
    setTicker('');
    setQuantity('');
    setPrice('');
    setTradeStep(1);
    setOtpCode('');
    setOtpSent(false);
    setEstimate(null);
  };

  const calculations = {
    effectivePrice: estimate?.effectivePrice || Number(price) || selectedStock?.currentPrice || 0,
    totalAmount: estimate?.grossAmount || 0,
    feeAmount: estimate?.feeAmount || 0,
    finalBuyTotal: estimate?.totalAmount || 0,
    finalSellTotal: estimate?.totalAmount || 0,
    feeRate: estimate?.feeRate || 0.0015,
    valid: estimate ? estimate.valid : true,
    validationMessage: estimate?.validationMessage || '',
  };

  const holdingQty = portfolio.find((p) => p.ticker === selectedStock?.ticker)?.quantity || 0;

  const canTrade = useCallback(() => {
    if (!selectedStock || !quantity || Number(quantity) <= 0) return false;
    if (orderType === 'LIMIT' && (!price || Number(price) <= 0)) return false;
    if (estimate) return estimate.valid;
    return true;
  }, [selectedStock, quantity, price, orderType, estimate]);

  const handleSendOtp = async () => {
    setOtpLoading(true);
    try {
      const res = await otpAPI.sendOtp();
      if (res.data.success) {
        setOtpSent(true);
        setMessage({ type: 'success', text: 'Đã gửi mã OTP đến email của bạn!' });
        return true;
      }
    } catch {
      setMessage({ type: 'error', text: 'Lỗi gửi OTP' });
    } finally {
      setOtpLoading(false);
    }
    return false;
  };

  const handlePlaceOrder = async () => {
    if (!canTrade()) return;
    setLoading(true);
    setMessage(null);

    try {
      const data = {
        ticker: selectedStock.ticker,
        side: activeTab,
        orderType,
        quantity: Number(quantity),
        otpCode,
      };

      if (orderType === 'LIMIT') {
        data.price = Number(price);
      }

      const res = await orderAPI.placeOrder(data);

      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        resetForm();
        if (onOrderSuccess) onOrderSuccess(res.data.data);
      } else {
        setMessage({ type: 'error', text: res.data.message });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi đặt lệnh';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    orderType,
    setOrderType,
    ticker,
    setTicker,
    quantity,
    setQuantity,
    price,
    setPrice,
    selectedStock,
    setSelectedStock,
    searchResults,
    showDropdown,
    setShowDropdown,
    tradeStep,
    setTradeStep,
    otpCode,
    setOtpCode,
    otpSent,
    otpLoading,
    loading,
    message,
    setMessage,
    calculations,
    holdingQty,
    estimate,
    canTrade,
    handleSelectStock,
    handleSelectPortfolioStock,
    handleSendOtp,
    handlePlaceOrder,
    resetForm,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { userAPI, tradeAPI, orderAPI } from '@/infrastructure/repositories/api';
import { useBatchWebSocket } from './useBatchWebSocket';

export function useTradingOrders({ lastResyncTime, activeTab }) {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [portfolio, setPortfolio] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await userAPI.getProfile();
      if (res.data.success) {
        setBalance(res.data.data.balance || 0);
        setLockedBalance(res.data.data.lockedBalance || 0);
      }
    } catch (err) {
      console.error('Lỗi tải số dư:', err);
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await tradeAPI.getPortfolio();
      if (res.data.success) {
        setPortfolio(res.data.data || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    try {
      const res = await orderAPI.getMyOrders(0, 5);
      if (res.data.success) {
        setRecentOrders(res.data.data.content || []);
      }
    } catch (err) {
      console.error('Lỗi tải lệnh:', err);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchPortfolio();
    fetchRecentOrders();
  }, [lastResyncTime, fetchBalance, fetchPortfolio, fetchRecentOrders]);

  useEffect(() => {
    if (activeTab === 'SELL') {
      fetchPortfolio();
    }
  }, [activeTab, fetchPortfolio]);

  useBatchWebSocket('/user/queue/balance', (batches) => {
    if (batches.length > 0) {
      const latest = batches[batches.length - 1];
      setBalance(latest.balance);
      setLockedBalance(latest.lockedBalance);
    }
  });

  useBatchWebSocket('/user/queue/portfolio', (batches) => {
    if (batches.length > 0) {
      const latest = batches[batches.length - 1];
      setPortfolio(latest.portfolios || []);
    }
  });

  useBatchWebSocket('/user/queue/orders', (batches) => {
    if (batches.length > 0) {
      setRecentOrders((prev) => {
        let newOrders = [...prev];
        batches.forEach((b) => {
          const updatedOrder = b.order;
          const idx = newOrders.findIndex((o) => o.id === updatedOrder.id);
          if (idx !== -1) {
            newOrders[idx] = updatedOrder;
          } else {
            newOrders.unshift(updatedOrder);
          }
        });
        return newOrders.slice(0, 5);
      });
    }
  });

  const availableBalance = Math.max(0, balance - lockedBalance);

  return {
    balance,
    lockedBalance,
    availableBalance,
    portfolio,
    recentOrders,
    refreshBalance: fetchBalance,
    refreshPortfolio: fetchPortfolio,
    refreshOrders: fetchRecentOrders,
  };
}

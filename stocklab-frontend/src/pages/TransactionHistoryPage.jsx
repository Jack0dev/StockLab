import { useState, useEffect } from 'react';
import { tradeAPI } from '../api/api';
import { usePageTour } from '../hooks/usePageTour';
import { useBatchWebSocket } from '../hooks/useBatchWebSocket';
import { useRef } from 'react';
import './TransactionHistoryPage.css';

const TYPE_FILTERS = [
  { label: 'Tất cả', value: '' },
  { label: 'Mua', value: 'BUY' },
  { label: 'Bán', value: 'SELL' },
];

export default function TransactionHistoryPage() {
  const { restartTour } = usePageTour('transactions');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const processedIds = useRef(new Set());

  useEffect(() => {
    fetchTransactions();
  }, [page, typeFilter]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await tradeAPI.getTransactions(page, 15, typeFilter);
      if (res.data.success) {
        const data = res.data.data;
        setTransactions(data.content);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);

        // Populate processedIds
        data.content.forEach(tx => processedIds.current.add(tx.id));
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử giao dịch:', err);
    } finally {
      setLoading(false);
    }
  };

  useBatchWebSocket('/user/queue/transactions', (batches) => {
    if (batches.length === 0) return;

    setTransactions(prev => {
      const newTxs = [];
      batches.forEach(b => {
        if (b.type === 'NEW_TRANSACTION' && b.data) {
          const tx = b.data;
          // Dedupe event
          if (!processedIds.current.has(tx.id)) {
            processedIds.current.add(tx.id);
            // Áp dụng bộ lọc type (nếu đang lọc)
            if (!typeFilter || tx.type === typeFilter) {
              newTxs.push(tx);
            }
          }
        }
      });

      if (newTxs.length === 0) return prev;
      
      setTotalElements(curr => curr + newTxs.length);
      return [...newTxs, ...prev];
    });
  });

  const formatPrice = (price) => {
    if (!price) return '0';
    return Number(price).toLocaleString('vi-VN');
  };

  const formatDateTime = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTickerColor = (ticker) => {
    const colors = ['#2962ff', '#00c853', '#ff6d00', '#aa00ff', '#d50000', '#00bfa5', '#6200ea', '#c51162'];
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="tx-history-page fade-in">
      <div className="tx-header">
        <h2>📜 Lịch sử giao dịch</h2>
        <div className="tx-header-right">
          <span className="tx-count">{totalElements} giao dịch</span>
          <div className="type-filter">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.value}
                className={`filter-btn ${typeFilter === f.value ? 'active' : ''}`}
                onClick={() => { setTypeFilter(f.value); setPage(0); }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
        </div>
      </div>

      {loading ? (
        <div className="tx-loading">
          <div className="spinner"></div>
          <span>Đang tải lịch sử giao dịch...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="tx-empty">
          <span style={{ fontSize: '2rem' }}>📭</span>
          <span>Chưa có giao dịch nào</span>
        </div>
      ) : (
        <div className="tx-table-wrapper">
          <table className="tx-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Mã CP</th>
                <th style={{ textAlign: 'left' }}>Tên công ty</th>
                <th>Loại</th>
                <th>Số lượng</th>
                <th>Giá</th>
                <th>Tổng tiền</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={{ textAlign: 'left' }}>
                    <div className="tx-ticker-cell">
                      <div
                        className="tx-ticker-icon"
                        style={{ background: getTickerColor(tx.ticker) }}
                      >
                        {tx.ticker.substring(0, 2)}
                      </div>
                      <span className="tx-ticker-symbol">{tx.ticker}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="tx-company">{tx.companyName}</span>
                  </td>
                  <td>
                    <span className={`tx-type-badge ${tx.type === 'BUY' ? 'buy' : 'sell'}`}>
                      {tx.type === 'BUY' ? 'MUA' : 'BÁN'}
                    </span>
                  </td>
                  <td className="tx-num-cell">{tx.quantity.toLocaleString('vi-VN')}</td>
                  <td className="tx-num-cell">{formatPrice(tx.price)}</td>
                  <td className={`tx-num-cell ${tx.type === 'BUY' ? 'text-danger' : 'text-success'}`}>
                    {tx.type === 'BUY' ? '-' : '+'}{formatPrice(tx.totalAmount)}
                  </td>
                  <td className="tx-time-cell">{formatDateTime(tx.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="tx-pagination">
              <button
                className="pagination-btn"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                ← Trước
              </button>
              <span className="pagination-info">
                Trang {page + 1} / {totalPages}
              </span>
              <button
                className="pagination-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Sau →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

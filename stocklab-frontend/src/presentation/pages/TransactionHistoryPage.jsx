import { useState, useEffect, useRef } from 'react';
import { tradeAPI } from '@/infrastructure/repositories/api';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { useBatchWebSocket } from '@/presentation/controllers/useBatchWebSocket';
import { formatPrice, formatDateTime } from '@/service/trading.service';
import './TransactionHistoryPage.css';

const TYPE_FILTERS = [
  { label: 'Tất cả lệnh', value: '' },
  { label: 'Lệnh Mua', value: 'BUY' },
  { label: 'Lệnh Bán', value: 'SELL' },
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

  return (
    <div className="tx-editorial-page fade-in">
      {/* Top Header */}
      <div className="tx-top-header">
        <div>
          <span className="tx-page-tag">SAO KÊ TÀI KHOẢN</span>
          <h1 className="tx-page-title">Nhật Ký Khớp Lệnh Giao Dịch</h1>
          <p className="tx-page-sub">
            Toàn bộ các giao dịch Mua và Bán cổ phiếu đã được khớp lệnh thành công trên hệ thống
          </p>
        </div>
        <div className="tx-header-actions">
          <button className="help-text-btn" onClick={restartTour} title="Hướng dẫn sử dụng">
            Trợ giúp
          </button>
        </div>
      </div>

      {/* Filter and summary bar */}
      <div className="tx-controls-bar">
        <div className="tx-filter-pills">
          {TYPE_FILTERS.map((f, idx) => (
            <button
              key={f.value}
              className={`tx-filter-tab ${typeFilter === f.value ? 'active' : ''}`}
              onClick={() => { setTypeFilter(f.value); setPage(0); }}
            >
              <span className="tx-filter-num mono-num">0{idx + 1}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
        <div className="tx-count-indicator">
          Tổng cộng: <strong className="mono-num tabular-num">{totalElements}</strong> giao dịch đã khớp
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="tx-state-card tx-loading">
          <div className="spinner"></div>
          <span className="state-text">Đang đồng bộ dữ liệu khớp lệnh...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="tx-state-card tx-empty">
          <span className="empty-title">Không tìm thấy giao dịch nào</span>
          <p className="empty-sub">
            {typeFilter ? 'Chưa có lệnh phù hợp với bộ lọc đã chọn.' : 'Tài khoản chưa phát sinh lệnh giao dịch khớp nào trên sàn.'}
          </p>
        </div>
      ) : (
        <div className="tx-table-container">
          <table className="tx-editorial-table">
            <thead>
              <tr>
                <th className="th-left">Mã Chứng Khoán</th>
                <th className="th-left">Tên Tổ Chức Phát Hành</th>
                <th>Chiều Lệnh</th>
                <th className="th-right">Khối Lượng</th>
                <th className="th-right">Giá Khớp (VNĐ)</th>
                <th className="th-right">Tổng Giá Trị</th>
                <th className="th-right">Thời Gian Khớp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const isBuy = tx.type === 'BUY';
                return (
                  <tr key={tx.id}>
                    <td className="th-left">
                      <div className="tx-ticker-pill mono-num">
                        {tx.ticker}
                      </div>
                    </td>
                    <td className="th-left">
                      <span className="tx-company-name">{tx.companyName || '—'}</span>
                    </td>
                    <td>
                      <span className={`tx-order-badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
                        {isBuy ? 'MUA' : 'BÁN'}
                      </span>
                    </td>
                    <td className="th-right font-medium tabular-num mono-num">
                      {tx.quantity?.toLocaleString('vi-VN')}
                    </td>
                    <td className="th-right font-medium tabular-num mono-num">
                      {formatPrice(tx.price)}
                    </td>
                    <td className={`th-right font-bold tabular-num mono-num ${isBuy ? 'text-bullish' : 'text-bearish'}`}>
                      {isBuy ? '-' : '+'}{formatPrice(tx.totalAmount)} ₫
                    </td>
                    <td className="th-right tabular-num text-muted">
                      {formatDateTime(tx.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="tx-pagination-bar">
              <button
                className="btn-page"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                ← Trang trước
              </button>
              <span className="page-indicator tabular-num mono-num">
                Trang {page + 1} / {totalPages}
              </span>
              <button
                className="btn-page"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Trang kế →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

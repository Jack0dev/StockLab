import { useState, useEffect } from 'react';
import { orderAPI } from '../api/api';
import { usePageTour } from '../hooks/usePageTour';
import './OrderHistoryPage.css';

export default function OrderHistoryPage() {
  const { restartTour } = usePageTour('orders');
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [modifyingOrder, setModifyingOrder] = useState(null);
  const [modifyQty, setModifyQty] = useState('');
  const [modifyPrice, setModifyPrice] = useState('');
  const [modifyLoading, setModifyLoading] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderAPI.getMyOrders(page, PAGE_SIZE, statusFilter);
      if (res.data.success) {
        setOrders(res.data.data.content || []);
        setTotalPages(res.data.data.totalPages || 0);
      }
    } catch (err) {
      console.error('Lỗi tải lệnh:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId, ticker) => {
    if (!window.confirm(`Bạn chắc chắn muốn hủy lệnh ${ticker}?`)) return;
    setCancellingId(orderId);
    try {
      const res = await orderAPI.cancelOrder(orderId);
      if (res.data.success) {
        alert(res.data.message);
        fetchOrders();
      } else {
        alert(res.data.message || 'Hủy lệnh thất bại');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi hủy lệnh');
    } finally {
      setCancellingId(null);
    }
  };

  const openModifyModal = (order) => {
    setModifyingOrder(order);
    setModifyQty(String(order.quantity));
    setModifyPrice(String(order.price));
  };

  const handleModify = async () => {
    if (!modifyingOrder) return;
    setModifyLoading(true);
    try {
      const res = await orderAPI.modifyOrder(modifyingOrder.id, {
        quantity: Number(modifyQty),
        price: Number(modifyPrice),
      });
      if (res.data.success) {
        alert(res.data.message);
        setModifyingOrder(null);
        fetchOrders();
      } else {
        alert(res.data.message || 'Sửa lệnh thất bại');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi sửa lệnh');
    } finally {
      setModifyLoading(false);
    }
  };

  const handleViewDetail = async (orderId) => {
    setDetailLoading(true);
    try {
      const res = await orderAPI.getOrderDetail(orderId);
      if (res.data.success) {
        setDetailOrder(res.data.data);
      } else {
        // Fallback: dùng data có sẵn từ list
        const found = orders.find(o => o.id === orderId);
        if (found) setDetailOrder(found);
      }
    } catch (err) {
      // Fallback: dùng data có sẵn từ list
      const found = orders.find(o => o.id === orderId);
      if (found) setDetailOrder(found);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatPrice = (p) => {
    if (!p) return '0';
    return Number(p).toLocaleString('vi-VN');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusLabel = (status) => {
    const map = {
      PENDING_TRIGGER: 'Chờ kích hoạt',
      ACTIVE: 'Chờ khớp',
      PARTIALLY_FILLED: 'Khớp 1 phần',
      FILLED: 'Đã khớp',
      CANCELLED: 'Đã hủy',
      EXPIRED: 'Hết hạn'
    };
    return map[status] || status;
  };

  const getStatusClass = (status) => {
    const map = {
      PENDING_TRIGGER: 'pending',
      ACTIVE: 'pending',
      PARTIALLY_FILLED: 'partial',
      FILLED: 'filled',
      CANCELLED: 'cancelled',
      EXPIRED: 'cancelled'
    };
    return map[status] || '';
  };

  const getTickerColor = (t) => {
    const colors = ['#2962ff', '#00c853', '#ff6d00', '#aa00ff', '#d50000', '#00bfa5', '#6200ea', '#c51162'];
    let hash = 0;
    for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const statusFilters = [
    { value: '', label: 'Tất cả' },
    { value: 'ACTIVE', label: 'Chờ khớp' },
    { value: 'PENDING_TRIGGER', label: 'Chờ kích hoạt' },
    { value: 'PARTIALLY_FILLED', label: 'Khớp 1 phần' },
    { value: 'FILLED', label: 'Đã khớp' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'EXPIRED', label: 'Hết hạn' },
  ];

  return (
    <div className="order-history-page fade-in">
      <div className="oh-header">
        <h2>📋 Sổ lệnh</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="oh-subtitle">Quản lý và theo dõi các lệnh đặt</span>
          <button className="page-tour-btn" onClick={restartTour} title="Hướng dẫn trang này">?</button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="oh-filters">
        {statusFilters.map(f => (
          <button
            key={f.value}
            className={`oh-filter-btn ${statusFilter === f.value ? 'active' : ''}`}
            onClick={() => { setStatusFilter(f.value); setPage(0); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="oh-table-card">
        {loading ? (
          <div className="oh-loading">Đang tải...</div>
        ) : orders.length === 0 ? (
          <div className="oh-empty">
            <div className="oh-empty-icon">📭</div>
            <div>Không có lệnh nào</div>
          </div>
        ) : (
          <>
            <div className="oh-table-wrapper">
              <table className="oh-table">
                <thead>
                  <tr>
                    <th>Mã CP</th>
                    <th>Loại</th>
                    <th>Lệnh</th>
                    <th>SL đặt</th>
                    <th>SL khớp</th>
                    <th>Giá</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="oh-row-clickable" onClick={() => handleViewDetail(order.id)}>
                      <td>
                        <div className="oh-ticker-cell">
                          <div
                            className="oh-ticker-icon"
                            style={{ background: getTickerColor(order.ticker) }}
                          >
                            {order.ticker.substring(0, 2)}
                          </div>
                          <div>
                            <div className="oh-ticker">{order.ticker}</div>
                            <div className="oh-company">{order.companyName}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="oh-order-type">
                          {order.orderType === 'MARKET' ? '⚡ Thường' : '📌 Giới hạn'}
                        </span>
                      </td>
                      <td>
                        <span className={`oh-side ${order.side === 'BUY' ? 'buy' : 'sell'}`}>
                          {order.side === 'BUY' ? 'MUA' : 'BÁN'}
                        </span>
                      </td>
                      <td className="oh-num">{order.quantity}</td>
                      <td className="oh-num">{order.filledQuantity}</td>
                      <td className="oh-num">{formatPrice(order.price)}</td>
                      <td className="oh-num">{formatPrice(order.price * order.quantity)}</td>
                      <td>
                        <span className={`oh-status ${getStatusClass(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="oh-date">{formatDate(order.createdAt)}</td>
                      <td>
                        <div className="oh-action-btns">
                          <button
                            className="oh-detail-btn"
                            onClick={(e) => { e.stopPropagation(); handleViewDetail(order.id); }}
                          >
                            Chi tiết
                          </button>
                          {(order.status === 'ACTIVE' || order.status === 'PARTIALLY_FILLED' || order.status === 'PENDING_TRIGGER') && (
                            <>
                              <button
                                className="oh-modify-btn"
                                onClick={(e) => { e.stopPropagation(); openModifyModal(order); }}
                              >
                                Sửa
                              </button>
                              <button
                                className="oh-cancel-btn"
                                disabled={cancellingId === order.id}
                                onClick={(e) => { e.stopPropagation(); handleCancel(order.id, order.ticker); }}
                              >
                                {cancellingId === order.id ? 'Đang hủy...' : 'Hủy'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="oh-pagination">
                <button
                  className="oh-page-btn"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Trước
                </button>
                <span className="oh-page-info">
                  Trang {page + 1} / {totalPages}
                </span>
                <button
                  className="oh-page-btn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Sau →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modify Modal */}
      {modifyingOrder && (
        <div className="oh-modal-overlay" onClick={() => setModifyingOrder(null)}>
          <div className="oh-modal fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="oh-modal-header">
              <h3>✏️ Sửa lệnh #{modifyingOrder.id}</h3>
              <button className="oh-modal-close" onClick={() => setModifyingOrder(null)}>×</button>
            </div>
            <div className="oh-modal-body">
              <div className="oh-modal-info">
                <span className={`oh-side ${modifyingOrder.side === 'BUY' ? 'buy' : 'sell'}`}>
                  {modifyingOrder.side === 'BUY' ? 'MUA' : 'BÁN'}
                </span>
                <span className="oh-modal-ticker">{modifyingOrder.ticker}</span>
                <span className="oh-modal-company">{modifyingOrder.companyName}</span>
              </div>
              <div className="oh-modal-field">
                <label>Số lượng mới</label>
                <input
                  type="number"
                  min="1"
                  value={modifyQty}
                  onChange={(e) => setModifyQty(e.target.value)}
                  className="form-input"
                />
                <span className="oh-modal-hint">Hiện tại: {modifyingOrder.quantity} CP (khớp {modifyingOrder.filledQuantity})</span>
              </div>
              <div className="oh-modal-field">
                <label>Giá mới (VND)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={modifyPrice}
                  onChange={(e) => setModifyPrice(e.target.value)}
                  className="form-input"
                />
                <span className="oh-modal-hint">Giá cũ: {formatPrice(modifyingOrder.price)} VND</span>
              </div>
              {modifyQty > 0 && modifyPrice > 0 && (
                <div className="oh-modal-summary">
                  <span>Tổng tiền mới:</span>
                  <span className="oh-modal-total">{formatPrice(Number(modifyQty) * Number(modifyPrice))} VND</span>
                </div>
              )}
            </div>
            <div className="oh-modal-footer">
              <button className="oh-modal-cancel" onClick={() => setModifyingOrder(null)}>Hủy bỏ</button>
              <button
                className="oh-modal-submit"
                disabled={modifyLoading || !modifyQty || !modifyPrice || Number(modifyQty) <= 0 || Number(modifyPrice) <= 0}
                onClick={handleModify}
              >
                {modifyLoading ? 'Đang xử lý...' : 'Xác nhận sửa lệnh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (
        <div className="oh-modal-overlay" onClick={() => setDetailOrder(null)}>
          <div className="oh-modal oh-detail-modal fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="oh-modal-header">
              <h3>📄 Chi tiết lệnh #{detailOrder.id}</h3>
              <button className="oh-modal-close" onClick={() => setDetailOrder(null)}>×</button>
            </div>
            <div className="oh-modal-body">
              {/* Ticker + Side */}
              <div className="detail-hero">
                <div className="detail-ticker-row">
                  <div className="oh-ticker-icon" style={{ background: getTickerColor(detailOrder.ticker) }}>
                    {detailOrder.ticker.substring(0, 2)}
                  </div>
                  <div>
                    <div className="detail-ticker">{detailOrder.ticker}</div>
                    <div className="detail-company">{detailOrder.companyName}</div>
                  </div>
                </div>
                <span className={`detail-side-badge ${detailOrder.side === 'BUY' ? 'buy' : 'sell'}`}>
                  {detailOrder.side === 'BUY' ? '📈 MUA' : '📉 BÁN'}
                </span>
              </div>

              {/* Status */}
              <div className="detail-status-row">
                <span className={`oh-status ${getStatusClass(detailOrder.status)}`}>
                  {getStatusLabel(detailOrder.status)}
                </span>
                <span className="detail-order-type">
                  {detailOrder.orderType === 'MARKET' ? '⚡ Lệnh thường' : '📌 Lệnh giới hạn'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="detail-progress">
                <div className="detail-progress-label">
                  <span>Tiến độ khớp lệnh</span>
                  <span>{detailOrder.filledQuantity}/{detailOrder.quantity} CP ({detailOrder.quantity > 0 ? Math.round(detailOrder.filledQuantity / detailOrder.quantity * 100) : 0}%)</span>
                </div>
                <div className="detail-progress-bar">
                  <div className="detail-progress-fill" style={{ width: `${detailOrder.quantity > 0 ? (detailOrder.filledQuantity / detailOrder.quantity * 100) : 0}%` }}></div>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Giá đặt</span>
                  <span className="detail-value">{formatPrice(detailOrder.price)} VND</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Số lượng đặt</span>
                  <span className="detail-value">{detailOrder.quantity} CP</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Đã khớp</span>
                  <span className="detail-value">{detailOrder.filledQuantity} CP</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Còn lại</span>
                  <span className="detail-value">{detailOrder.quantity - detailOrder.filledQuantity} CP</span>
                </div>
                <div className="detail-item full">
                  <span className="detail-label">Tổng giá trị</span>
                  <span className="detail-value total">{formatPrice((detailOrder.price || 0) * detailOrder.quantity)} VND</span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="detail-timestamps">
                <div className="detail-ts">
                  <span>🕐 Đặt lệnh:</span>
                  <span>{formatDate(detailOrder.createdAt)}</span>
                </div>
                {detailOrder.updatedAt && detailOrder.updatedAt !== detailOrder.createdAt && (
                  <div className="detail-ts">
                    <span>🔄 Cập nhật:</span>
                    <span>{formatDate(detailOrder.updatedAt)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="oh-modal-footer">
              {(detailOrder.status === 'ACTIVE' || detailOrder.status === 'PARTIALLY_FILLED' || detailOrder.status === 'PENDING_TRIGGER') && (
                <>
                  <button className="oh-modify-btn" onClick={() => { openModifyModal(detailOrder); setDetailOrder(null); }}>
                    ✏️ Sửa lệnh
                  </button>
                  <button className="oh-cancel-btn" onClick={() => { handleCancel(detailOrder.id, detailOrder.ticker); setDetailOrder(null); }}>
                    ❌ Hủy lệnh
                  </button>
                </>
              )}
              <button className="oh-modal-cancel" onClick={() => setDetailOrder(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

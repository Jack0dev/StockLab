import { useState, useEffect } from 'react';
import { orderAPI } from '@/infrastructure/repositories/api';
import { usePageTour } from '@/presentation/controllers/usePageTour';
import { useBatchWebSocket } from '@/presentation/controllers/useBatchWebSocket';
import { useWebSocket } from '@/infrastructure/context/WebSocketContext';
import {
  formatPrice,
  formatDateTime as formatDate,
  getStatusLabel,
  getStatusBadgeClass as getStatusClass,
} from '@/service/trading.service';
import './OrderHistoryPage.css';

export default function OrderHistoryPage() {
  const { restartTour } = usePageTour('orders');
  const { lastResyncTime } = useWebSocket();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
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
  }, [page, statusFilter, lastResyncTime]);

  useBatchWebSocket('/user/queue/orders', (batches) => {
    if (batches.length > 0) {
      setOrders(prev => {
        let newOrders = [...prev];
        batches.forEach(b => {
          const updatedOrder = b.order;
          const idx = newOrders.findIndex(o => o.id === updatedOrder.id);
          if (idx !== -1) {
            newOrders[idx] = updatedOrder;
          } else if (page === 0 && (statusFilter === '' || updatedOrder.status === statusFilter)) {
            newOrders.unshift(updatedOrder);
            if (newOrders.length > PAGE_SIZE) newOrders.pop();
          }
        });
        return newOrders;
      });
    }
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderAPI.getMyOrders(page, PAGE_SIZE, statusFilter);
      if (res.data.success) {
        setOrders(res.data.data.content || []);
        setTotalPages(res.data.data.totalPages || 0);
        setTotalElements(res.data.data.totalElements || 0);
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
      } else {
        alert(res.data.message || 'Sửa lệnh thất bại');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi sửa lệnh');
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
        const found = orders.find(o => o.id === orderId);
        if (found) setDetailOrder(found);
      }
    } catch (err) {
      const found = orders.find(o => o.id === orderId);
      if (found) setDetailOrder(found);
    } finally {
      setDetailLoading(false);
    }
  };

  const statusFilters = [
    { value: '', label: 'Tất cả lệnh' },
    { value: 'ACTIVE', label: 'Chờ khớp' },
    { value: 'PENDING_TRIGGER', label: 'Chờ kích hoạt' },
    { value: 'PARTIALLY_FILLED', label: 'Khớp 1 phần' },
    { value: 'FILLED', label: 'Đã khớp' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'EXPIRED', label: 'Hết hạn' },
  ];

  return (
    <div className="order-editorial-page fade-in">
      {/* Header */}
      <div className="order-top-header">
        <div>
          <span className="order-page-tag">SỔ LỆNH TÀI KHOẢN</span>
          <h1 className="order-page-title">Sổ Lệnh & Nhật Ký Đặt Lệnh</h1>
          <p className="order-page-sub">
            Theo dõi trạng thái các lệnh giao dịch Mua / Bán đang chờ khớp hoặc đã hoàn tất
          </p>
        </div>
        <div className="order-header-actions">
          <button className="help-text-btn" onClick={restartTour} title="Hướng dẫn sử dụng">
            Trợ giúp
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="order-controls-bar">
        <div className="order-filter-pills">
          {statusFilters.map((f, idx) => (
            <button
              key={f.value}
              className={`order-filter-tab ${statusFilter === f.value ? 'active' : ''}`}
              onClick={() => { setStatusFilter(f.value); setPage(0); }}
            >
              <span className="order-filter-idx mono-num">0{idx + 1}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
        <div className="order-count-indicator">
          Tổng cộng: <strong className="mono-num tabular-num">{totalElements}</strong> lệnh
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="order-table-card">
        {loading ? (
          <div className="order-loading-box">
            <div className="spinner"></div>
            <span>Đang đồng bộ dữ liệu sổ lệnh...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="order-empty-card">
            <h4 className="empty-title">Không Tìm Thấy Lệnh Nào</h4>
            <p className="empty-sub">
              {statusFilter ? 'Không có lệnh nào phù hợp với bộ lọc trạng thái đã chọn.' : 'Tài khoản chưa có lệnh giao dịch nào trong sổ lệnh.'}
            </p>
          </div>
        ) : (
          <>
            <div className="order-table-scroll">
              <table className="order-editorial-table">
                <thead>
                  <tr>
                    <th className="th-left">Mã CP</th>
                    <th>Loại Lệnh</th>
                    <th>Chiều</th>
                    <th className="th-right">SL Đặt</th>
                    <th className="th-right">SL Khớp</th>
                    <th className="th-right">Giá Đặt</th>
                    <th className="th-right">Tổng Tiền</th>
                    <th>Trạng Thái</th>
                    <th className="th-right">Thời Gian</th>
                    <th className="th-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const isBuy = order.side === 'BUY';
                    return (
                      <tr key={order.id} className="order-row-hover" onClick={() => handleViewDetail(order.id)}>
                        <td className="th-left">
                          <div className="order-ticker-box">
                            <span className="order-ticker-code mono-num">{order.ticker}</span>
                            <span className="order-company-text">{order.companyName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="order-type-tag">
                            {order.orderType === 'MARKET' ? 'MP (Thị trường)' : 'LO (Giới hạn)'}
                          </span>
                        </td>
                        <td>
                          <span className={`order-side-tag ${isBuy ? 'tag-buy' : 'tag-sell'}`}>
                            {isBuy ? 'MUA' : 'BÁN'}
                          </span>
                        </td>
                        <td className="th-right tabular-num mono-num font-medium">{order.quantity?.toLocaleString('vi-VN')}</td>
                        <td className="th-right tabular-num mono-num">{order.filledQuantity?.toLocaleString('vi-VN')}</td>
                        <td className="th-right tabular-num mono-num">{formatPrice(order.price)}</td>
                        <td className="th-right tabular-num mono-num font-bold">{formatPrice(order.price * order.quantity)} ₫</td>
                        <td>
                          <span className={`order-status-badge ${getStatusClass(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="th-right tabular-num text-muted">{formatDate(order.createdAt)}</td>
                        <td className="th-center">
                          <div className="order-action-group">
                            <button
                              className="btn-order-action btn-order-detail"
                              onClick={(e) => { e.stopPropagation(); handleViewDetail(order.id); }}
                            >
                              Chi tiết
                            </button>
                            {(order.status === 'ACTIVE' || order.status === 'PARTIALLY_FILLED' || order.status === 'PENDING_TRIGGER') && (
                              <>
                                <button
                                  className="btn-order-action btn-order-modify"
                                  onClick={(e) => { e.stopPropagation(); openModifyModal(order); }}
                                >
                                  Sửa
                                </button>
                                <button
                                  className="btn-order-action btn-order-cancel"
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="order-pagination-bar">
                <button
                  className="btn-page"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Trang trước
                </button>
                <span className="page-indicator mono-num tabular-num">
                  Trang {page + 1} / {totalPages}
                </span>
                <button
                  className="btn-page"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Trang kế →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modify Modal */}
      {modifyingOrder && (
        <div className="order-modal-backdrop" onClick={() => setModifyingOrder(null)}>
          <div className="order-modal-card fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <span className="order-modal-kicker">HIỆU CHỈNH LỆNH ĐẶT</span>
              <h3 className="order-modal-title">Sửa Lệnh #{modifyingOrder.id}</h3>
              <button className="order-modal-close" onClick={() => setModifyingOrder(null)}>✕</button>
            </div>
            <div className="order-modal-body">
              <div className="order-modal-hero">
                <span className={`order-side-tag ${modifyingOrder.side === 'BUY' ? 'tag-buy' : 'tag-sell'}`}>
                  {modifyingOrder.side === 'BUY' ? 'MUA' : 'BÁN'}
                </span>
                <span className="order-modal-ticker mono-num">{modifyingOrder.ticker}</span>
                <span className="order-modal-company">{modifyingOrder.companyName}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Số lượng mới (CP)</label>
                <input
                  type="number"
                  min="1"
                  value={modifyQty}
                  onChange={(e) => setModifyQty(e.target.value)}
                  className="form-input mono-num"
                />
                <span className="input-hint-sub">Hiện tại: {modifyingOrder.quantity} CP (khớp {modifyingOrder.filledQuantity})</span>
              </div>
              <div className="form-group">
                <label className="form-label">Giá đặt mới (VNĐ)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={modifyPrice}
                  onChange={(e) => setModifyPrice(e.target.value)}
                  className="form-input mono-num"
                />
                <span className="input-hint-sub">Giá cũ: {formatPrice(modifyingOrder.price)} VNĐ</span>
              </div>
              {modifyQty > 0 && modifyPrice > 0 && (
                <div className="order-modal-summary-box">
                  <span className="summary-label">Tổng giá trị lệnh mới:</span>
                  <strong className="summary-val text-bullish tabular-num mono-num">
                    {formatPrice(Number(modifyQty) * Number(modifyPrice))} VNĐ
                  </strong>
                </div>
              )}
            </div>
            <div className="order-modal-footer">
              <button className="btn btn-outline" onClick={() => setModifyingOrder(null)}>Hủy bỏ</button>
              <button
                className="btn btn-primary"
                disabled={modifyLoading || !modifyQty || !modifyPrice || Number(modifyQty) <= 0 || Number(modifyPrice) <= 0}
                onClick={handleModify}
              >
                {modifyLoading ? 'Đang lưu...' : 'Xác Nhận Sửa Lệnh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (
        <div className="order-modal-backdrop" onClick={() => setDetailOrder(null)}>
          <div className="order-modal-card detail-modal fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <span className="order-modal-kicker">SAO KÊ CHI TIẾT</span>
              <h3 className="order-modal-title">Chi Tiết Lệnh #{detailOrder.id}</h3>
              <button className="order-modal-close" onClick={() => setDetailOrder(null)}>✕</button>
            </div>
            <div className="order-modal-body">
              {/* Ticker + Side */}
              <div className="detail-hero-bar">
                <div>
                  <span className="detail-ticker-symbol mono-num">{detailOrder.ticker}</span>
                  <span className="detail-ticker-name">{detailOrder.companyName}</span>
                </div>
                <span className={`order-side-tag ${detailOrder.side === 'BUY' ? 'tag-buy' : 'tag-sell'}`}>
                  {detailOrder.side === 'BUY' ? 'LỆNH MUA' : 'LỆNH BÁN'}
                </span>
              </div>

              {/* Status */}
              <div className="detail-status-strip">
                <span className={`order-status-badge ${getStatusClass(detailOrder.status)}`}>
                  {getStatusLabel(detailOrder.status)}
                </span>
                <span className="detail-type-text">
                  {detailOrder.orderType === 'MARKET' ? 'Lệnh thị trường (MP)' : 'Lệnh giới hạn (LO)'}
                </span>
              </div>

              {/* Progress */}
              <div className="detail-progress-container">
                <div className="detail-progress-header">
                  <span>Tiến độ khớp lệnh</span>
                  <span className="mono-num tabular-num">
                    {detailOrder.filledQuantity}/{detailOrder.quantity} CP ({detailOrder.quantity > 0 ? Math.round(detailOrder.filledQuantity / detailOrder.quantity * 100) : 0}%)
                  </span>
                </div>
                <div className="detail-progress-track">
                  <div
                    className="detail-progress-fill"
                    style={{ width: `${detailOrder.quantity > 0 ? (detailOrder.filledQuantity / detailOrder.quantity * 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="detail-spec-sheet">
                <div className="spec-row">
                  <span className="spec-label">Giá đặt lệnh</span>
                  <span className="spec-val mono-num tabular-num">{formatPrice(detailOrder.price)} VNĐ</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Số lượng đặt</span>
                  <span className="spec-val mono-num tabular-num">{detailOrder.quantity} CP</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Khối lượng đã khớp</span>
                  <span className="spec-val mono-num tabular-num text-bullish">{detailOrder.filledQuantity} CP</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Khối lượng còn lại</span>
                  <span className="spec-val mono-num tabular-num">{detailOrder.quantity - detailOrder.filledQuantity} CP</span>
                </div>
                <div className="spec-row spec-total">
                  <span className="spec-label">Tổng giá trị lệnh</span>
                  <span className="spec-val mono-num tabular-num font-bold">
                    {formatPrice((detailOrder.price || 0) * detailOrder.quantity)} VNĐ
                  </span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="detail-timestamps-box">
                <div className="ts-row">
                  <span>Thời điểm tạo lệnh:</span>
                  <strong className="mono-num tabular-num">{formatDate(detailOrder.createdAt)}</strong>
                </div>
                {detailOrder.updatedAt && detailOrder.updatedAt !== detailOrder.createdAt && (
                  <div className="ts-row">
                    <span>Thời điểm cập nhật:</span>
                    <strong className="mono-num tabular-num">{formatDate(detailOrder.updatedAt)}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="order-modal-footer">
              {(detailOrder.status === 'ACTIVE' || detailOrder.status === 'PARTIALLY_FILLED' || detailOrder.status === 'PENDING_TRIGGER') && (
                <>
                  <button className="btn btn-secondary" onClick={() => { openModifyModal(detailOrder); setDetailOrder(null); }}>
                    Sửa lệnh
                  </button>
                  <button className="btn btn-outline" style={{ color: '#e11d48', borderColor: '#fecdd3' }} onClick={() => { handleCancel(detailOrder.id, detailOrder.ticker); setDetailOrder(null); }}>
                    Hủy lệnh
                  </button>
                </>
              )}
              <button className="btn btn-primary" onClick={() => setDetailOrder(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminOrderAPI, orderAPI } from '@/infrastructure/repositories/api';
import './AdminOrdersPage.css';

const ModalOverlay = ({ children, onClose }) => (
    <div className="admin-modal-backdrop" onClick={onClose}>
        <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const AdminOrdersPage = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState(''); // Search by Ticker or Username
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL'); // BUY/SELL

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Modals
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, order: null });
    const [orderBookModal, setOrderBookModal] = useState({ isOpen: false, ticker: null, data: null, loading: false });
    const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'success' });

    useEffect(() => {
        fetchOrders();
    }, []);

    // Polling mỗi 2.5s để cập nhật realtime
    useEffect(() => {
        const interval = setInterval(() => {
            fetchOrdersSilent();
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    const fetchOrdersSilent = async () => {
        try {
            const response = await adminOrderAPI.getAllOrders({ size: 2000 });
            if (response.data.success) {
                setOrders(response.data.data.content || response.data.data);
            }
        } catch { /* ignore */ }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await adminOrderAPI.getAllOrders({ size: 2000 });
            if (response.data.success) {
                setOrders(response.data.data.content || response.data.data);
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi khi tải danh sách lệnh hệ thống');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ isOpen: true, message, type });
    };

    const processedOrders = useMemo(() => {
        let filtered = orders.filter(order => {
            const matchSearch = order.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (order.user?.username || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = filterStatus === 'ALL' || order.status === filterStatus;
            const matchType = filterType === 'ALL' || order.type === filterType;
            return matchSearch && matchStatus && matchType;
        });

        // Sort by createdAt descending
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return filtered;
    }, [orders, searchTerm, filterStatus, filterType]);

    const totalPages = Math.ceil(processedOrders.length / itemsPerPage);
    const paginatedOrders = processedOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterType, itemsPerPage]);

    const handleForceCancel = async () => {
        const { order } = confirmModal;
        setConfirmModal({ isOpen: false, order: null });
        try {
            const response = await adminOrderAPI.forceCancelOrder(order.id);
            if (response.data.success) {
                showNotification('Đã thực hiện hủy lệnh thành công!', 'success');
                fetchOrders();
            } else {
                showNotification(response.data.message, 'error');
            }
        } catch (err) {
            showNotification(err.response?.data?.message || 'Lỗi khi hủy lệnh', 'error');
        }
    };

    const handleViewOrderBook = async (ticker) => {
        setOrderBookModal({ isOpen: true, ticker, data: null, loading: true });
        try {
            const response = await orderAPI.getOrderBook(ticker);
            if (response.data.success) {
                setOrderBookModal({ isOpen: true, ticker, data: response.data.data, loading: false });
            } else {
                setOrderBookModal(prev => ({ ...prev, loading: false }));
                showNotification(response.data.message, 'error');
            }
        } catch (err) {
            setOrderBookModal(prev => ({ ...prev, loading: false }));
            showNotification('Lỗi khi tải sổ lệnh', 'error');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'FILLED':
                return <span className="order-status-pill status-filled">Đã khớp hết</span>;
            case 'ACTIVE':
                return <span className="order-status-pill status-active-order">Chờ khớp</span>;
            case 'PENDING_TRIGGER':
                return <span className="order-status-pill status-pending-trigger">Chờ kích hoạt</span>;
            case 'PARTIALLY_FILLED':
                return <span className="order-status-pill status-partial">Khớp một phần</span>;
            case 'CANCELLED':
                return <span className="order-status-pill status-cancelled">Đã hủy</span>;
            case 'EXPIRED':
                return <span className="order-status-pill status-expired">Hết hạn</span>;
            default:
                return <span className="order-status-pill">{status}</span>;
        }
    };

    return (
        <div className="admin-orders-page">
            {/* Header */}
            <div className="admin-orders-header">
                <div>
                    <span className="admin-orders-kicker">Phân hệ Giám sát giao dịch</span>
                    <h1 className="admin-orders-title">Sổ Lệnh Toàn Nền Tảng</h1>
                    <p className="admin-orders-sub">
                        Theo dõi thời gian thực mọi lệnh mua/bán của nhà đầu tư và bot thanh khoản. Hỗ trợ can thiệp cưỡng chế hủy lệnh khi có sự cố.
                    </p>
                </div>
            </div>
            
            {/* Filters */}
            <div className="admin-orders-toolbar">
                <input 
                    type="text" 
                    placeholder="Tìm theo mã CP, tài khoản user..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="admin-search-input"
                />
                
                <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value)}
                    className="admin-filter-select"
                >
                    <option value="ALL">Tất cả chiều lệnh</option>
                    <option value="BUY">Lệnh MUA (Buy)</option>
                    <option value="SELL">Lệnh BÁN (Sell)</option>
                </select>

                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="admin-filter-select"
                >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Chờ khớp (ACTIVE)</option>
                    <option value="PENDING_TRIGGER">Chờ kích hoạt (PENDING_TRIGGER)</option>
                    <option value="PARTIALLY_FILLED">Khớp một phần (PARTIALLY_FILLED)</option>
                    <option value="FILLED">Đã khớp hết (FILLED)</option>
                    <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                    <option value="EXPIRED">Hết hạn (EXPIRED)</option>
                </select>

                <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="admin-filter-select"
                >
                    <option value={20}>20 lệnh / trang</option>
                    <option value={50}>50 lệnh / trang</option>
                    <option value={100}>100 lệnh / trang</option>
                </select>
            </div>

            {error && (
                <div style={{ color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}
            
            <div className="admin-orders-card">
                <div className="admin-orders-table-scroll">
                    <table className="admin-orders-table">
                        <thead>
                            <tr>
                                <th style={{ width: '70px' }}>ID</th>
                                <th>Tài khoản</th>
                                <th>Chiều & Loại</th>
                                <th>Mã CP</th>
                                <th className="th-right">Mức giá</th>
                                <th className="th-right">KL Đặt / Đã khớp</th>
                                <th>Trạng thái</th>
                                <th>Thời gian</th>
                                <th className="th-center" style={{ width: '130px' }}>Can thiệp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && orders.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                                    </td>
                                </tr>
                            ) : paginatedOrders.map(order => (
                                <tr key={order.id}>
                                    <td className="mono-num" style={{ color: '#94a3b8' }}>#{order.id}</td>
                                    <td>
                                        <span className="font-bold">{order.user?.username || order.user?.email || 'N/A'}</span>
                                    </td>
                                    <td>
                                        <span className={`order-side-tag ${order.type === 'BUY' ? 'order-side-buy' : 'order-side-sell'}`}>
                                            {order.type} {order.orderType}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span 
                                                style={{ fontWeight: '800', fontFamily: 'var(--font-mono, monospace)', cursor: 'pointer', color: '#090d16' }}
                                                onClick={() => navigate(`/stocks/${order.ticker}`)}
                                                title={`Xem biểu đồ giao dịch & phân tích kỹ thuật ${order.ticker}`}
                                            >
                                                {order.ticker} <span style={{ fontSize: '0.7rem', color: '#64748b' }}>↗</span>
                                            </span>
                                            <button 
                                                onClick={() => handleViewOrderBook(order.ticker)}
                                                className="btn-view-book"
                                                title="Xem sổ lệnh thị trường"
                                            >
                                                Sổ lệnh
                                            </button>
                                            <button 
                                                onClick={() => navigate(`/stocks/${order.ticker}`)}
                                                className="btn-view-book"
                                                style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: '700' }}
                                                title="Xem biểu đồ kỹ thuật mã này"
                                            >
                                                Biểu đồ
                                            </button>
                                        </div>
                                    </td>
                                    <td className="th-right tabular-num font-bold">
                                        {order.orderType === 'MARKET' ? 'MP' : `${order.price?.toLocaleString('vi-VN')} đ`}
                                    </td>
                                    <td className="th-right tabular-num">
                                        <span style={{ color: '#475569' }}>{order.quantity?.toLocaleString('vi-VN')}</span>
                                        {' / '}
                                        <span className="font-bold text-bullish">
                                            {(order.status === 'FILLED' ? order.quantity : (order.filledQuantity || 0)).toLocaleString('vi-VN')}
                                        </span>
                                    </td>
                                    <td>
                                        {getStatusBadge(order.status)}
                                    </td>
                                    <td className="tabular-num" style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="th-center">
                                        {(order.status === 'ACTIVE' || order.status === 'PARTIALLY_FILLED' || order.status === 'PENDING_TRIGGER') ? (
                                            <button 
                                                onClick={() => setConfirmModal({ isOpen: true, order })}
                                                className="btn-action-cancel"
                                                title="Cưỡng chế hủy lệnh"
                                            >
                                                Hủy lệnh
                                            </button>
                                        ) : (
                                            <span style={{ color: '#cbd5e1' }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && paginatedOrders.length === 0 && (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                        Không có lệnh giao dịch nào khớp với bộ lọc hiện tại.
                    </div>
                )}

                {totalPages > 0 && (
                    <div className="admin-pagination-bar">
                        <div>
                            Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, processedOrders.length)} / Tổng số {processedOrders.length} lệnh
                        </div>
                        <div className="admin-pagination-controls">
                            <button 
                                disabled={currentPage === 1} 
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} 
                                className="btn-page-nav"
                            >
                                Trước
                            </button>
                            <span className="page-index-label tabular-num">
                                {currentPage} / {totalPages}
                            </span>
                            <button 
                                disabled={currentPage === totalPages} 
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} 
                                className="btn-page-nav"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Thông Báo */}
            {notification.isOpen && (
                <ModalOverlay onClose={() => setNotification({ ...notification, isOpen: false })}>
                    <div className="admin-notice-box">
                        <div className={`notice-status-badge ${notification.type}`}>
                            {notification.type === 'success' ? 'Hoàn tất tác vụ' : 'Cảnh báo lỗi'}
                        </div>
                        <p className="notice-message">{notification.message}</p>
                        <button 
                            onClick={() => setNotification({ ...notification, isOpen: false })} 
                            className="btn-page-nav"
                            style={{ margin: '0 auto', display: 'inline-flex', padding: '0.5rem 1.5rem', background: '#090d16', color: '#fff', borderColor: '#090d16' }}
                        >
                            Đã hiểu & Đóng
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Xác Nhận Cưỡng Chế Hủy Lệnh */}
            {confirmModal.isOpen && confirmModal.order && (
                <ModalOverlay onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                    <div className="admin-modal-header">
                        <h3 className="admin-modal-title" style={{ color: '#e11d48' }}>Xác nhận cưỡng chế hủy lệnh</h3>
                        <button className="admin-modal-close" onClick={() => setConfirmModal({ isOpen: false, order: null })}>✕</button>
                    </div>
                    <p style={{ margin: '0 0 1.5rem', lineHeight: '1.6', fontSize: '0.925rem', color: '#475569' }}>
                        Bạn có chắc chắn muốn hủy lệnh <strong style={{ color: '#090d16' }}>#{confirmModal.order.id}</strong> ({confirmModal.order.type} {confirmModal.order.ticker}) của người dùng <strong style={{ color: '#090d16' }}>{confirmModal.order.user?.username || confirmModal.order.user?.email}</strong>?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button 
                            onClick={() => setConfirmModal({ isOpen: false, order: null })} 
                            className="btn-page-nav"
                        >
                            Quay lại
                        </button>
                        <button 
                            onClick={handleForceCancel} 
                            className="btn-action-cancel"
                            style={{ padding: '0.5rem 1.25rem' }}
                        >
                            Xác nhận hủy ngay
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Sổ Lệnh (Order Book) */}
            {orderBookModal.isOpen && (
                <ModalOverlay onClose={() => setOrderBookModal({ isOpen: false, ticker: null, data: null, loading: false })}>
                    <div className="admin-modal-header">
                        <h3 className="admin-modal-title">Sổ lệnh thị trường — {orderBookModal.ticker}</h3>
                        <button 
                            onClick={() => setOrderBookModal({ isOpen: false, ticker: null, data: null, loading: false })} 
                            className="admin-modal-close"
                        >
                            ✕
                        </button>
                    </div>
                    {orderBookModal.loading ? (
                        <div style={{ textAlign: 'center', padding: '30px' }}>
                            <div className="spinner" style={{ margin: '0 auto' }}></div>
                        </div>
                    ) : orderBookModal.data ? (
                        <div className="orderbook-split-container">
                            {/* Dư Mua (Bids) */}
                            <div>
                                <div className="orderbook-col-header bids">Dư Mua (Bids)</div>
                                <table className="orderbook-subtable">
                                    <thead>
                                        <tr>
                                            <th>Mức giá</th>
                                            <th>Khối lượng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orderBookModal.data.buyOrders?.map((opt, i) => (
                                            <tr key={i}>
                                                <td className="tabular-num" style={{ color: '#059669', fontWeight: '700' }}>
                                                    {opt.price.toLocaleString('vi-VN')}
                                                </td>
                                                <td className="tabular-num" style={{ color: '#090d16' }}>
                                                    {opt.totalQuantity.toLocaleString('vi-VN')}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!orderBookModal.data.buyOrders || orderBookModal.data.buyOrders.length === 0) && (
                                            <tr><td colSpan="2" style={{ textAlign: 'center', color: '#94a3b8', padding: '15px' }}>Trống</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="orderbook-divider"></div>

                            {/* Dư Bán (Asks) */}
                            <div>
                                <div className="orderbook-col-header asks">Dư Bán (Asks)</div>
                                <table className="orderbook-subtable">
                                    <thead>
                                        <tr>
                                            <th>Mức giá</th>
                                            <th>Khối lượng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orderBookModal.data.sellOrders?.slice().reverse().map((opt, i) => (
                                            <tr key={i}>
                                                <td className="tabular-num" style={{ color: '#e11d48', fontWeight: '700' }}>
                                                    {opt.price.toLocaleString('vi-VN')}
                                                </td>
                                                <td className="tabular-num" style={{ color: '#090d16' }}>
                                                    {opt.totalQuantity.toLocaleString('vi-VN')}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!orderBookModal.data.sellOrders || orderBookModal.data.sellOrders.length === 0) && (
                                            <tr><td colSpan="2" style={{ textAlign: 'center', color: '#94a3b8', padding: '15px' }}>Trống</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#e11d48', padding: '20px' }}>
                            Không thể tải dữ liệu sổ lệnh.
                        </div>
                    )}
                </ModalOverlay>
            )}
        </div>
    );
};

export default AdminOrdersPage;

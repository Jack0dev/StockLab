import { useState, useEffect, useMemo, useCallback } from 'react';
import { adminOrderAPI, orderAPI } from '../api/api';
import { useWebSocket } from '../hooks/useWebSocket';

const ModalOverlay = ({ children, onClose }) => (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#1f1f1f', padding: '24px', borderRadius: '8px',
            width: '600px', maxWidth: '90%', border: '1px solid #333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', color: '#fff',
            maxHeight: '90vh', overflowY: 'auto'
        }}>
            {children}
        </div>
    </div>
);

const AdminOrdersPage = () => {
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

    // Realtime: khi có giao dịch khớp → tự động cập nhật danh sách lệnh
    const handleTradeUpdate = useCallback(() => {
        fetchOrdersSilent();
    }, []);

    useWebSocket('/topic/trades', handleTradeUpdate);

    // Fetch không hiện loading (cho realtime update)
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
            setError(err.response?.data?.message || 'Lỗi khi tải danh sách lệnh. (API chưa sẵn sàng hoặc không gọi được)');
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
                showNotification('Huỷ lệnh thành công!', 'success');
                fetchOrders();
            } else {
                showNotification(response.data.message, 'error');
            }
        } catch (err) {
            showNotification(err.response?.data?.message || 'Lỗi khi huỷ lệnh', 'error');
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

    return (
        <div style={{ padding: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Quản lý Lệnh (All Orders)</h2>
                <button 
                    onClick={fetchOrders}
                    style={{ padding: '8px 16px', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    ↻ Cập nhật
                </button>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    placeholder="Tìm theo mã CP, tên user..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, minWidth: '250px', padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none' }}
                />
                
                <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="ALL">Tất cả Loại</option>
                    <option value="BUY">MUA (BUY)</option>
                    <option value="SELL">BÁN (SELL)</option>
                </select>

                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="ALL">Tất cả Trạng thái</option>
                    <option value="ACTIVE">Chờ khớp (ACTIVE)</option>
                    <option value="PENDING_TRIGGER">Chờ kích hoạt (PENDING_TRIGGER)</option>
                    <option value="PARTIALLY_FILLED">Khớp một phần (PARTIALLY_FILLED)</option>
                    <option value="FILLED">Đã khớp hết (FILLED)</option>
                    <option value="CANCELLED">Đã huỷ (CANCELLED)</option>
                    <option value="EXPIRED">Hết hạn (EXPIRED)</option>
                </select>

                <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value={20}>20 dòng / trang</option>
                    <option value={50}>50 dòng / trang</option>
                    <option value={100}>100 dòng / trang</option>
                </select>
            </div>

            {error && <div style={{ color: '#ff4d4f', marginBottom: '15px' }}>{error}</div>}
            
            <div style={{ overflowX: 'auto', backgroundColor: '#141414', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#1f1f1f', borderBottom: '1px solid #333', color: '#888' }}>
                            <th style={{ padding: '12px' }}>ID</th>
                            <th style={{ padding: '12px' }}>User</th>
                            <th style={{ padding: '12px' }}>Loại Lệnh</th>
                            <th style={{ padding: '12px' }}>Mã CP</th>
                            <th style={{ padding: '12px' }}>Giá (đ)</th>
                            <th style={{ padding: '12px' }}>KL Đặt / Khớp</th>
                            <th style={{ padding: '12px' }}>Trạng Thái</th>
                            <th style={{ padding: '12px' }}>Ngày Đặt</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}><div className="spinner" style={{ display: 'inline-block' }}></div></td></tr>
                        ) : paginatedOrders.map(order => (
                            <tr key={order.id} style={{ borderBottom: '1px solid #333' }}>
                                <td style={{ padding: '12px', color: '#888' }}>#{order.id}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{order.user?.username || order.user?.email || 'N/A'}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ 
                                        color: order.type === 'BUY' ? '#52c41a' : '#ff4d4f', 
                                        fontWeight: 'bold', border: `1px solid ${order.type === 'BUY' ? '#52c41a' : '#ff4d4f'}`, 
                                        padding: '2px 6px', borderRadius: '4px', fontSize: '12px' 
                                    }}>
                                        {order.type} {order.orderType}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', fontWeight: 'bold', color: '#1890ff' }}>
                                    {order.ticker}
                                    <button 
                                        onClick={() => handleViewOrderBook(order.ticker)}
                                        style={{ marginLeft: '8px', background: 'none', border: '1px solid #1890ff', color: '#1890ff', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
                                        title="Xem sổ lệnh"
                                    >📊 Sổ Lệnh</button>
                                </td>
                                <td style={{ padding: '12px' }}>{order.orderType === 'MARKET' ? 'MP' : order.price?.toLocaleString('vi-VN')}</td>
                                <td style={{ padding: '12px' }}>{order.quantity?.toLocaleString('vi-VN')} / <span style={{color: '#52c41a'}}>{order.filledQty?.toLocaleString('vi-VN') || 0}</span></td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ 
                                        color: order.status === 'FILLED' ? '#52c41a' : 
                                               order.status === 'ACTIVE' ? '#faad14' : 
                                               order.status === 'PENDING_TRIGGER' ? '#ff8c00' :
                                               order.status === 'CANCELLED' ? '#888' : 
                                               order.status === 'PARTIALLY_FILLED' ? '#1890ff' :
                                               order.status === 'EXPIRED' ? '#888' : '#ff4d4f'
                                    }}>
                                        {order.status === 'ACTIVE' ? 'Chờ Khớp' : 
                                         order.status === 'PENDING_TRIGGER' ? 'Chờ Kích Hoạt' :
                                         order.status === 'PARTIALLY_FILLED' ? 'Khớp 1 phần' : 
                                         order.status === 'FILLED' ? 'Khớp Hết' : 
                                         order.status === 'CANCELLED' ? 'Đã Huỷ' : 
                                         order.status === 'EXPIRED' ? 'Hết Hạn' : order.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', color: '#aaa' }}>{new Date(order.createdAt).toLocaleString('vi-VN')}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    {(order.status === 'ACTIVE' || order.status === 'PARTIALLY_FILLED' || order.status === 'PENDING_TRIGGER') ? (
                                        <button 
                                            onClick={() => setConfirmModal({ isOpen: true, order })}
                                            style={{ padding: '4px 8px', backgroundColor: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            Force Cancel
                                        </button>
                                    ) : (
                                        <span style={{ color: '#555', fontSize: '12px' }}>-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!loading && paginatedOrders.length === 0 && (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                        Không có lệnh nào thoả mãn.
                    </div>
                )}
            </div>

            {totalPages > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', backgroundColor: '#141414', padding: '10px 15px', borderRadius: '8px' }}>
                    <div style={{ color: '#888', fontSize: '14px' }}>
                        Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, processedOrders.length)} / Tổng {processedOrders.length}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} style={{ padding: '4px 10px', backgroundColor: currentPage === 1 ? '#333' : '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Trước</button>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{currentPage} / {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} style={{ padding: '4px 10px', backgroundColor: currentPage === totalPages ? '#333' : '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>Sau</button>
                    </div>
                </div>
            )}

            {notification.isOpen && (
                <ModalOverlay onClose={() => setNotification({ ...notification, isOpen: false })}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px', color: notification.type === 'success' ? '#52c41a' : '#ff4d4f' }}>
                            {notification.type === 'success' ? '✅' : '❌'}
                        </div>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#fff' }}>Thông Báo</h3>
                        <p style={{ marginBottom: '24px', lineHeight: '1.5' }}>{notification.message}</p>
                        <button onClick={() => setNotification({ ...notification, isOpen: false })} style={{ padding: '8px 30px', borderRadius: '4px', border: 'none', backgroundColor: '#1890ff', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Đóng</button>
                    </div>
                </ModalOverlay>
            )}

            {confirmModal.isOpen && confirmModal.order && (
                <ModalOverlay onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#ff4d4f', textAlign: 'center' }}>Xác Nhận Cưỡng Chế Huỷ Lệnh</h3>
                    <p style={{ textAlign: 'center', marginBottom: '24px', lineHeight: '1.5' }}>
                        Bạn có chắc muốn huỷ lệnh <strong>#{confirmModal.order.id}</strong> ({confirmModal.order.type} {confirmModal.order.ticker}) của User <strong>{confirmModal.order.user?.username || confirmModal.order.user?.email}</strong>?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button onClick={() => setConfirmModal({ isOpen: false, order: null })} style={{ padding: '8px 20px', borderRadius: '4px', border: '1px solid #555', backgroundColor: 'transparent', color: '#fff', cursor: 'pointer' }}>Quay lại</button>
                        <button onClick={handleForceCancel} style={{ padding: '8px 20px', borderRadius: '4px', border: 'none', backgroundColor: '#ff4d4f', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Thực hiện Huỷ</button>
                    </div>
                </ModalOverlay>
            )}

            {orderBookModal.isOpen && (
                <ModalOverlay onClose={() => setOrderBookModal({ isOpen: false, ticker: null, data: null, loading: false })}>
                    <div style={{ borderBottom: '1px solid #333', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, color: '#1890ff' }}>Sổ Lệnh (Order Book) - {orderBookModal.ticker}</h3>
                        <button onClick={() => setOrderBookModal({ isOpen: false, ticker: null, data: null, loading: false })} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                    </div>
                    {orderBookModal.loading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}><div className="spinner" style={{ display: 'inline-block' }}></div></div>
                    ) : orderBookModal.data ? (
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ color: '#52c41a', textAlign: 'center', marginBottom: '10px' }}>Dư Mua (Bids)</h4>
                                <table style={{ width: '100%', fontSize: '13px', textAlign: 'right' }}>
                                    <thead><tr style={{ color: '#888' }}><th>Giá</th><th style={{ paddingLeft: '15px' }}>Khối Lượng</th></tr></thead>
                                    <tbody>
                                        {orderBookModal.data.buyOrders?.map((opt, i) => (
                                            <tr key={i}>
                                                <td style={{ color: '#52c41a' }}>{opt.price.toLocaleString('vi-VN')}</td>
                                                <td style={{ paddingLeft: '15px' }}>{opt.totalQuantity.toLocaleString('vi-VN')}</td>
                                            </tr>
                                        ))}
                                        {(!orderBookModal.data.buyOrders || orderBookModal.data.buyOrders.length === 0) && <tr><td colSpan="2" style={{ textAlign: 'center', color: '#555', padding: '10px' }}>Trống</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ width: '1px', backgroundColor: '#333' }}></div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ color: '#ff4d4f', textAlign: 'center', marginBottom: '10px' }}>Dư Bán (Asks)</h4>
                                <table style={{ width: '100%', fontSize: '13px', textAlign: 'right' }}>
                                    <thead><tr style={{ color: '#888' }}><th>Giá</th><th style={{ paddingLeft: '15px' }}>Khối Lượng</th></tr></thead>
                                    <tbody>
                                        {orderBookModal.data.sellOrders?.slice().reverse().map((opt, i) => (
                                            <tr key={i}>
                                                <td style={{ color: '#ff4d4f' }}>{opt.price.toLocaleString('vi-VN')}</td>
                                                <td style={{ paddingLeft: '15px' }}>{opt.totalQuantity.toLocaleString('vi-VN')}</td>
                                            </tr>
                                        ))}
                                        {(!orderBookModal.data.sellOrders || orderBookModal.data.sellOrders.length === 0) && <tr><td colSpan="2" style={{ textAlign: 'center', color: '#555', padding: '10px' }}>Trống</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#ff4d4f' }}>Lỗi khi tải dữ liệu sổ lệnh.</div>
                    )}
                </ModalOverlay>
            )}
        </div>
    );
};

export default AdminOrdersPage;

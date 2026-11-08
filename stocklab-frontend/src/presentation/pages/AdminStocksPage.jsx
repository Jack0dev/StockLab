import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminStockAPI } from '@/infrastructure/repositories/api';
import { useWebSocket } from '@/presentation/controllers/useWebSocket';
import './AdminStocksPage.css';

const ModalOverlay = ({ children, onClose }) => (
    <div className="admin-modal-backdrop" onClick={onClose}>
        <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const AdminStocksPage = () => {
    const navigate = useNavigate();
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Advanced Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterExchange, setFilterExchange] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, ACTIVE, INACTIVE

    // Sorting
    const [sortConfig, setSortConfig] = useState({ key: 'ticker', direction: 'asc' });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modals
    const [stockModal, setStockModal] = useState({ isOpen: false, isEdit: false, data: null });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, stockId: null, actionDesc: '', actionType: '', ticker: '' });
    const [detailModal, setDetailModal] = useState({ isOpen: false, stock: null });
    
    // Notification Modal
    const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'success' });

    const [formData, setFormData] = useState({ ticker: '', companyName: '', exchange: 'HOSE', basePrice: '' });

    useEffect(() => {
        fetchStocks();
    }, []);

    // Realtime: cập nhật giá cổ phiếu qua WebSocket
    const handlePriceUpdate = useCallback((priceData) => {
        if (!Array.isArray(priceData)) return;
        setStocks(prev => prev.map(stock => {
            const update = priceData.find(p => p.ticker === stock.ticker);
            if (!update) return stock;
            return { ...stock, currentPrice: update.currentPrice, change: update.change, changePercent: update.changePercent, volume: update.volume };
        }));
    }, []);

    useWebSocket('/topic/prices', handlePriceUpdate);

    const fetchStocks = async () => {
        setLoading(true);
        try {
            const response = await adminStockAPI.getAllStocks({ size: 2000 });
            if (response.data.success) {
                setStocks(response.data.data.content || response.data.data);
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi khi tải danh sách cổ phiếu');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ isOpen: true, message, type });
    };

    // --- Hành động Lọc, Phân trang, Sắp xếp ---
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return <span className="sort-icon">⇅</span>;
        return <span className="sort-icon active">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    const processedStocks = useMemo(() => {
        // 1. Lọc
        let filtered = stocks.filter(stock => {
            const isStockActive = stock.active !== undefined ? stock.active : stock.isActive;
            const matchSearch = stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                stock.companyName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchExchange = filterExchange === 'ALL' || stock.exchange === filterExchange;
            const matchStatus = filterStatus === 'ALL' || 
                                (filterStatus === 'ACTIVE' && isStockActive) || 
                                (filterStatus === 'INACTIVE' && !isStockActive);
            return matchSearch && matchExchange && matchStatus;
        });

        // 2. Sắp xếp
        filtered.sort((a, b) => {
            let valA = a[sortConfig.key] ?? '';
            let valB = b[sortConfig.key] ?? '';
            
            if (sortConfig.key === 'isActive') {
                valA = a.active !== undefined ? a.active : a.isActive;
                valB = b.active !== undefined ? b.active : b.isActive;
            }
            
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            if (typeof valA === 'boolean' && typeof valB === 'boolean') {
                return sortConfig.direction === 'asc' ? (valA === valB ? 0 : valA ? -1 : 1) : (valA === valB ? 0 : valA ? 1 : -1);
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [stocks, searchTerm, filterExchange, filterStatus, sortConfig]);

    // 3. Cắt theo Pagination
    const totalPages = Math.ceil(processedStocks.length / itemsPerPage);
    const paginatedStocks = processedStocks.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterExchange, filterStatus, itemsPerPage]);

    // --- API & UI Hành động ---
    const requestToggleStatus = (stock) => {
        const isStockActive = stock.active !== undefined ? stock.active : stock.isActive;
        const actionDesc = isStockActive ? 'Khóa giao dịch' : 'Mở khóa giao dịch';
        setConfirmModal({
            isOpen: true,
            stockId: stock.id,
            actionDesc: actionDesc,
            actionType: 'TOGGLE_STATUS',
            ticker: stock.ticker
        });
    };

    const requestDelete = (stock) => {
        setConfirmModal({
            isOpen: true,
            stockId: stock.id,
            actionDesc: 'Xóa vĩnh viễn',
            actionType: 'DELETE',
            ticker: stock.ticker
        });
    };

    const executeConfirmAction = async () => {
        const { stockId, actionType } = confirmModal;
        setConfirmModal({ isOpen: false, stockId: null, actionDesc: '', actionType: '', ticker: '' });
        
        try {
            let response;
            if (actionType === 'TOGGLE_STATUS') {
                response = await adminStockAPI.toggleStockStatus(stockId);
            } else if (actionType === 'DELETE') {
                response = await adminStockAPI.deleteStock(stockId);
            }
            if (response.data.success) {
                showNotification(response.data.message, 'success');
                fetchStocks();
            } else {
                showNotification(response.data.message, 'error');
            }
        } catch (err) {
            showNotification(err.response?.data?.message || 'Lỗi thao tác trên cổ phiếu', 'error');
        }
    };

    const handleOpenCreate = () => {
        setFormData({ ticker: '', companyName: '', exchange: 'HOSE', basePrice: '' });
        setStockModal({ isOpen: true, isEdit: false, data: null });
    };

    const handleOpenEdit = (stock) => {
        setFormData({
            ticker: stock.ticker,
            companyName: stock.companyName,
            exchange: stock.exchange,
            basePrice: stock.referencePrice || stock.currentPrice || 0
        });
        setStockModal({ isOpen: true, isEdit: true, data: stock });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (stockModal.isEdit) {
                response = await adminStockAPI.updateStock(stockModal.data.id, formData);
            } else {
                response = await adminStockAPI.createStock(formData);
            }
            
            if (response.data.success) {
                showNotification(response.data.message, 'success');
                setStockModal({ isOpen: false, isEdit: false, data: null });
                fetchStocks();
            } else {
                showNotification(response.data.message, 'error');
            }
        } catch (err) {
            showNotification(err.response?.data?.message || 'Lỗi khi lưu cổ phiếu', 'error');
        }
    };

    if (loading && stocks.length === 0) {
        return (
            <div className="admin-stocks-page">
                <div className="spinner" style={{ margin: '80px auto' }}></div>
            </div>
        );
    }

    return (
        <div className="admin-stocks-page">
            {/* Header */}
            <div className="admin-stocks-header">
                <div>
                    <span className="admin-stocks-kicker">Phân hệ Danh mục niêm yết</span>
                    <h1 className="admin-stocks-title">Quản lý Cổ phiếu & Thị trường</h1>
                    <p className="admin-stocks-sub">
                        Cấu hình mã chứng khoán, kiểm soát sàn niêm yết, cập nhật giá cơ sở và điều hành trạng thái khớp lệnh trực tiếp.
                    </p>
                </div>
                <button 
                    onClick={handleOpenCreate}
                    className="btn-primary-action"
                >
                    + Thêm cổ phiếu mới
                </button>
            </div>
            
            {/* Bộ lọc (Filter Nâng Cao) */}
            <div className="admin-stocks-toolbar">
                <input 
                    type="text" 
                    placeholder="Tìm theo mã CP, tên doanh nghiệp..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="admin-search-input"
                />
                
                <select 
                    value={filterExchange} 
                    onChange={(e) => setFilterExchange(e.target.value)}
                    className="admin-filter-select"
                >
                    <option value="ALL">Tất cả sàn</option>
                    <option value="HOSE">Sàn HOSE</option>
                    <option value="HNX">Sàn HNX</option>
                    <option value="UPCOM">Sàn UPCOM</option>
                </select>

                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="admin-filter-select"
                >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang giao dịch</option>
                    <option value="INACTIVE">Ngừng giao dịch</option>
                </select>

                <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="admin-filter-select"
                >
                    <option value={10}>10 mã / trang</option>
                    <option value={20}>20 mã / trang</option>
                    <option value={50}>50 mã / trang</option>
                </select>
            </div>

            {error && (
                <div style={{ color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}
            
            {/* Table */}
            <div className="admin-stocks-card">
                <div className="admin-stocks-table-scroll">
                    <table className="admin-stocks-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('ticker')} className="sortable-th" style={{ width: '100px' }}>
                                    Mã CP {getSortIndicator('ticker')}
                                </th>
                                <th onClick={() => handleSort('companyName')} className="sortable-th">
                                    Tên công ty {getSortIndicator('companyName')}
                                </th>
                                <th onClick={() => handleSort('exchange')} className="sortable-th" style={{ width: '90px' }}>
                                    Sàn {getSortIndicator('exchange')}
                                </th>
                                <th onClick={() => handleSort('currentPrice')} className="sortable-th th-right" style={{ width: '130px' }}>
                                    Giá hiện tại {getSortIndicator('currentPrice')}
                                </th>
                                <th onClick={() => handleSort('isActive')} className="sortable-th" style={{ width: '150px' }}>
                                    Trạng thái {getSortIndicator('isActive')}
                                </th>
                                <th className="th-center" style={{ width: '220px' }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedStocks.map(stock => {
                                const isStockActive = stock.active !== undefined ? stock.active : stock.isActive;
                                return (
                                    <tr key={stock.id} className={!isStockActive ? 'row-inactive' : ''}>
                                        <td>
                                            <span 
                                                className="stock-ticker-pill clickable-ticker"
                                                onClick={() => navigate(`/stocks/${stock.ticker}`)}
                                                title={`Xem biểu đồ giao dịch & phân tích kỹ thuật ${stock.ticker}`}
                                            >
                                                {stock.ticker} <span style={{ fontSize: '0.7rem', color: '#64748b' }}>↗</span>
                                            </span>
                                        </td>
                                        <td 
                                            className="stock-company-cell clickable-company"
                                            onClick={() => navigate(`/stocks/${stock.ticker}`)}
                                            title={`Xem chi tiết doanh nghiệp ${stock.companyName}`}
                                        >
                                            {stock.companyName}
                                        </td>
                                        <td>
                                            <span className="exchange-pill">{stock.exchange}</span>
                                        </td>
                                        <td className="th-right tabular-num" style={{ fontWeight: '700', color: '#090d16' }}>
                                            {stock.currentPrice?.toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            {isStockActive ? (
                                                <span className="status-indicator-tag status-active">
                                                    Đang giao dịch
                                                </span>
                                            ) : (
                                                <span className="status-indicator-tag status-inactive">
                                                    Ngừng giao dịch
                                                </span>
                                            )}
                                        </td>
                                        <td className="th-center">
                                            <div className="stock-actions-group">
                                                <button 
                                                    onClick={() => navigate(`/stocks/${stock.ticker}`)}
                                                    className="btn-action-sm btn-chart"
                                                    title="Xem biểu đồ nến kỹ thuật & sổ lệnh giao dịch"
                                                >
                                                    Biểu đồ
                                                </button>
                                                <button 
                                                    onClick={() => setDetailModal({ isOpen: true, stock })}
                                                    className="btn-action-sm btn-detail"
                                                    title="Xem chi tiết thông số"
                                                >
                                                    Chi tiết
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenEdit(stock)}
                                                    className="btn-action-sm btn-edit"
                                                    title="Chỉnh sửa thông tin"
                                                >
                                                    Sửa
                                                </button>
                                                <button 
                                                    onClick={() => requestToggleStatus(stock)}
                                                    className={`btn-action-sm ${isStockActive ? 'btn-lock' : 'btn-unlock'}`}
                                                    title={isStockActive ? 'Tạm dừng niêm yết' : 'Kích hoạt lại'}
                                                >
                                                    {isStockActive ? 'Khóa' : 'Mở'}
                                                </button>
                                                <button 
                                                    onClick={() => requestDelete(stock)}
                                                    className="btn-action-sm btn-delete"
                                                    title="Xóa vĩnh viễn"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {paginatedStocks.length === 0 && (
                    <div className="admin-empty-state">
                        Không tìm thấy cổ phiếu nào thỏa mãn điều kiện bộ lọc.
                    </div>
                )}

                {/* Phân trang (Pagination) */}
                {totalPages > 0 && (
                    <div className="admin-pagination-bar">
                        <div>
                            Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, processedStocks.length)} / Tổng số {processedStocks.length} mã
                        </div>
                        <div className="admin-pagination-controls">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                className="btn-page-nav"
                            >
                                Trước
                            </button>
                            <span className="page-index-label tabular-num">
                                {currentPage} / {totalPages}
                            </span>
                            <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                className="btn-page-nav"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Thông Báo Phản Hồi */}
            {notification.isOpen && (
                <ModalOverlay onClose={() => setNotification({ ...notification, isOpen: false })}>
                    <div className="admin-notice-box">
                        <div className={`notice-status-badge ${notification.type}`}>
                            {notification.type === 'success' ? 'Hoàn tất tác vụ' : 'Cảnh báo lỗi'}
                        </div>
                        <p className="notice-message">
                            {notification.message}
                        </p>
                        <button 
                            onClick={() => setNotification({ ...notification, isOpen: false })}
                            className="btn-primary-action"
                            style={{ margin: '0 auto', display: 'inline-flex' }}
                        >
                            Đã hiểu & Đóng
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Xác nhận */}
            {confirmModal.isOpen && (
                <ModalOverlay onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                    <div className="admin-modal-header">
                        <h3 className="admin-modal-title">Xác nhận điều chỉnh</h3>
                        <button className="admin-modal-close" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>✕</button>
                    </div>
                    <p style={{ margin: '0 0 1.5rem', lineHeight: '1.6', fontSize: '0.925rem', color: '#475569' }}>
                        Bạn có chắc chắn muốn <strong style={{ color: '#090d16' }}>{confirmModal.actionDesc.toLowerCase()}</strong> mã cổ phiếu 
                        <strong style={{ color: '#090d16' }}> {confirmModal.ticker}</strong> không?
                    </p>
                    <div className="admin-modal-actions">
                        <button 
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            className="btn-action-sm btn-detail"
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={executeConfirmAction}
                            className={`btn-action-sm ${confirmModal.actionType === 'DELETE' ? 'btn-delete' : 'btn-lock'}`}
                            style={{ padding: '0.5rem 1.25rem' }}
                        >
                            Xác nhận thực thi
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Chi Tiết Cổ Phiếu */}
            {detailModal.isOpen && detailModal.stock && (
                <ModalOverlay onClose={() => setDetailModal({ isOpen: false, stock: null })}>
                    <div className="admin-modal-header">
                        <h3 className="admin-modal-title">Chi tiết mã niêm yết</h3>
                        <button 
                            onClick={() => setDetailModal({ isOpen: false, stock: null })}
                            className="admin-modal-close"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="admin-modal-detail-list">
                        <div className="admin-modal-row">
                            <span className="modal-label">Mã chứng khoán</span>
                            <span className="modal-val stock-ticker-pill">{detailModal.stock.ticker}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Doanh nghiệp</span>
                            <span className="modal-val">{detailModal.stock.companyName}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Sàn giao dịch</span>
                            <span className="modal-val exchange-pill">{detailModal.stock.exchange}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Giá tham chiếu cơ sở</span>
                            <span className="modal-val tabular-num">
                                {detailModal.stock.referencePrice?.toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Giá thị trường hiện tại</span>
                            <span className="modal-val tabular-num" style={{ fontWeight: '800' }}>
                                {detailModal.stock.currentPrice?.toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Biến động trong phiên</span>
                            <span className={`modal-val tabular-num ${detailModal.stock.change >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                                {detailModal.stock.change > 0 ? '+' : ''}{detailModal.stock.change?.toLocaleString('vi-VN')} đ 
                                ({detailModal.stock.changePercent > 0 ? '+' : ''}{detailModal.stock.changePercent}%)
                            </span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Khối lượng khớp lệnh</span>
                            <span className="modal-val tabular-num">
                                {detailModal.stock.volume?.toLocaleString('vi-VN')} CP
                            </span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Tình trạng niêm yết</span>
                            <span className="modal-val">
                                {(detailModal.stock.active ?? detailModal.stock.isActive) ? (
                                    <span className="status-indicator-tag status-active">Đang giao dịch</span>
                                ) : (
                                    <span className="status-indicator-tag status-inactive">Ngừng giao dịch</span>
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="admin-modal-actions" style={{ justifyContent: 'space-between', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
                        <button 
                            type="button"
                            onClick={() => {
                                const t = detailModal.stock.ticker;
                                setDetailModal({ isOpen: false, stock: null });
                                navigate(`/stocks/${t}`);
                            }}
                            className="btn-modal-chart"
                            title="Mở biểu đồ kỹ thuật & bảng giá chi tiết"
                        >
                            📊 Mở Biểu Đồ & Dữ Liệu Kỹ Thuật Chi Tiết →
                        </button>
                        <button 
                            onClick={() => setDetailModal({ isOpen: false, stock: null })}
                            className="btn-action-sm btn-detail"
                            style={{ padding: '0.55rem 1.25rem' }}
                        >
                            Đóng cửa sổ
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Form Thêm / Sửa */}
            {stockModal.isOpen && (
                <ModalOverlay onClose={() => setStockModal({ ...stockModal, isOpen: false })}>
                    <div className="admin-modal-header">
                        <h3 className="admin-modal-title">
                            {stockModal.isEdit ? 'Chỉnh sửa Cổ phiếu' : 'Đăng ký Cổ phiếu mới'}
                        </h3>
                        <button 
                            onClick={() => setStockModal({ ...stockModal, isOpen: false })}
                            className="admin-modal-close"
                        >✕</button>
                    </div>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Mã chứng khoán (Ticker) *</label>
                            <input 
                                type="text" 
                                required 
                                value={formData.ticker}
                                onChange={e => setFormData({...formData, ticker: e.target.value.toUpperCase()})}
                                className="admin-form-input"
                                placeholder="VD: VNM"
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Tên công ty niêm yết *</label>
                            <input 
                                type="text" 
                                required 
                                value={formData.companyName}
                                onChange={e => setFormData({...formData, companyName: e.target.value})}
                                className="admin-form-input"
                                placeholder="VD: Sữa Việt Nam"
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Sàn giao dịch niêm yết</label>
                            <select 
                                value={formData.exchange}
                                onChange={e => setFormData({...formData, exchange: e.target.value})}
                                className="admin-filter-select"
                                style={{ width: '100%' }}
                            >
                                <option value="HOSE">HOSE (TP. Hồ Chí Minh)</option>
                                <option value="HNX">HNX (Hà Nội)</option>
                                <option value="UPCOM">UPCOM</option>
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Giá tham chiếu / Cơ sở (VND) *</label>
                            <input 
                                type="number" 
                                required 
                                value={formData.basePrice}
                                onChange={e => setFormData({...formData, basePrice: e.target.value})}
                                className="admin-form-input"
                                placeholder="VD: 78000"
                            />
                        </div>
                        
                        <div className="admin-modal-actions">
                            <button 
                                type="button"
                                onClick={() => setStockModal({ ...stockModal, isOpen: false })}
                                className="btn-action-sm btn-detail"
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                type="submit"
                                className="btn-primary-action"
                                style={{ padding: '0.5rem 1.25rem' }}
                            >
                                {stockModal.isEdit ? 'Lưu thay đổi' : 'Tạo mới mã'}
                            </button>
                        </div>
                    </form>
                </ModalOverlay>
            )}
        </div>
    );
};

export default AdminStocksPage;

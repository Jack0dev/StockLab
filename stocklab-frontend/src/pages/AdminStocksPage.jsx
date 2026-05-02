import { useState, useEffect, useMemo, useCallback } from 'react';
import { adminStockAPI } from '../api/api';
import { useWebSocket } from '../hooks/useWebSocket';

const ModalOverlay = ({ children, onClose }) => (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#1f1f1f', padding: '24px', borderRadius: '8px',
            width: '450px', maxWidth: '90%', border: '1px solid #333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', color: '#fff',
            maxHeight: '90vh', overflowY: 'auto'
        }}>
            {children}
        </div>
    </div>
);

const AdminStocksPage = () => {
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
    
    // Notification Modal instead of window.alert
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

    // --- Hành động Lọc, Phân trang, Sắp xếp (Advanced) ---
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return ' ⇅';
        return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
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
            
            // Xử lý sort riêng cho isActive vì dữ liệu trả về bị đổi tên thành active
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
        const actionDesc = isStockActive ? 'Khoá Giao Dịch' : 'Mở Khoá Giao Dịch';
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
            actionDesc: 'Xoá vĩnh viễn',
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

    if (loading && stocks.length === 0) return <div className="spinner" style={{ margin: '50px auto' }}></div>;

    return (
        <div style={{ padding: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Quản lý Cổ phiếu (Stocks) nâng cao</h2>
                <button 
                    onClick={handleOpenCreate}
                    style={{ padding: '8px 16px', backgroundColor: '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    + Thêm Cổ Phiếu Mới
                </button>
            </div>
            
            {/* Bộ lọc (Filter Nâng Cao) */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    placeholder="Tìm theo mã CP, tên công ty..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, minWidth: '250px', padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none' }}
                />
                
                <select 
                    value={filterExchange} 
                    onChange={(e) => setFilterExchange(e.target.value)}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="ALL">Tất cả sàn</option>
                    <option value="HOSE">HOSE</option>
                    <option value="HNX">HNX</option>
                    <option value="UPCOM">UPCOM</option>
                </select>

                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang Giao Dịch</option>
                    <option value="INACTIVE">Ngừng Giao Dịch</option>
                </select>

                <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value={10}>10 dòng / trang</option>
                    <option value={20}>20 dòng / trang</option>
                    <option value={50}>50 dòng / trang</option>
                </select>
            </div>

            {error && <div style={{ color: '#ff4d4f', marginBottom: '15px' }}>{error}</div>}
            
            {/* Table (Kèm Sort) */}
            <div style={{ overflowX: 'auto', backgroundColor: '#141414', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#1f1f1f', borderBottom: '1px solid #333' }}>
                            <th onClick={() => handleSort('ticker')} style={{ padding: '16px', cursor: 'pointer', userSelect: 'none' }}>Mã CP {getSortIndicator('ticker')}</th>
                            <th onClick={() => handleSort('companyName')} style={{ padding: '16px', cursor: 'pointer', userSelect: 'none' }}>Tên Công Ty {getSortIndicator('companyName')}</th>
                            <th onClick={() => handleSort('exchange')} style={{ padding: '16px', cursor: 'pointer', userSelect: 'none' }}>Sàn {getSortIndicator('exchange')}</th>
                            <th onClick={() => handleSort('currentPrice')} style={{ padding: '16px', cursor: 'pointer', userSelect: 'none' }}>Giá T.Tại (đ) {getSortIndicator('currentPrice')}</th>
                            <th onClick={() => handleSort('isActive')} style={{ padding: '16px', cursor: 'pointer', userSelect: 'none' }}>Trạng Thái {getSortIndicator('isActive')}</th>
                            <th style={{ padding: '16px', textAlign: 'center' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedStocks.map(stock => {
                            const isStockActive = stock.active !== undefined ? stock.active : stock.isActive;
                            return (
                                <tr key={stock.id} style={{ 
                                    borderBottom: '1px solid #333', 
                                    transition: 'background-color 0.3s',
                                    backgroundColor: isStockActive ? 'transparent' : 'rgba(255, 77, 79, 0.05)'
                                }}>
                                    <td style={{ padding: '16px', fontWeight: 'bold', color: '#1890ff' }}>{stock.ticker}</td>
                                    <td style={{ padding: '16px' }}>{stock.companyName}</td>
                                    <td style={{ padding: '16px' }}>{stock.exchange}</td>
                                    <td style={{ padding: '16px', color: '#faad14', fontWeight: 'bold' }}>
                                        {stock.currentPrice?.toLocaleString('vi-VN')}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {isStockActive ? (
                                            <span style={{ color: '#52c41a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#52c41a' }}></div>
                                                Đang Giao Dịch
                                            </span>
                                        ) : (
                                            <span style={{ color: '#ff4d4f', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4d4f' }}></div>
                                                Ngừng Giao Dịch
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button 
                                                onClick={() => setDetailModal({ isOpen: true, stock })}
                                                style={{ padding: '6px 12px', backgroundColor: '#08979c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                Chi tiết
                                            </button>
                                            <button 
                                                onClick={() => handleOpenEdit(stock)}
                                                style={{ padding: '6px 12px', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                Sửa
                                            </button>
                                            <button 
                                                onClick={() => requestToggleStatus(stock)}
                                                style={{ padding: '6px 12px', backgroundColor: isStockActive ? '#faad14' : '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                {isStockActive ? 'Khoá' : 'Mở Khoá'}
                                            </button>
                                            <button 
                                                onClick={() => requestDelete(stock)}
                                                style={{ padding: '6px 12px', backgroundColor: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                Xoá
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {paginatedStocks.length === 0 && (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                        Không tìm thấy cổ phiếu nào thoả mãn bộ lọc.
                    </div>
                )}
            </div>

            {/* Phân trang (Pagination) */}
            {totalPages > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', backgroundColor: '#141414', padding: '10px 15px', borderRadius: '8px' }}>
                    <div style={{ color: '#888' }}>
                        Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, processedStocks.length)} / Tổng số {processedStocks.length}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            style={{ padding: '6px 12px', backgroundColor: currentPage === 1 ? '#333' : '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                        >
                            Trang trước
                        </button>
                        <span style={{ padding: '6px 12px', color: '#fff', fontWeight: 'bold' }}>
                            {currentPage} / {totalPages}
                        </span>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            style={{ padding: '6px 12px', backgroundColor: currentPage === totalPages ? '#333' : '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                        >
                            Trang sau
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Thông Báo (Chữ nhật chính giữa thay thế window.alert) */}
            {notification.isOpen && (
                <ModalOverlay onClose={() => setNotification({ ...notification, isOpen: false })}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                            fontSize: '48px', 
                            marginBottom: '16px',
                            color: notification.type === 'success' ? '#52c41a' : '#ff4d4f'
                        }}>
                            {notification.type === 'success' ? '✅' : '❌'}
                        </div>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#fff' }}>
                            {notification.type === 'success' ? 'Thành Công' : 'Thông Báo Lỗi'}
                        </h3>
                        <p style={{ marginBottom: '24px', lineHeight: '1.5', fontSize: '16px' }}>
                            {notification.message}
                        </p>
                        <button 
                            onClick={() => setNotification({ ...notification, isOpen: false })}
                            style={{ padding: '8px 30px', borderRadius: '4px', border: 'none', backgroundColor: '#1890ff', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Xác nhận Đóng
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Xác nhận (Confirm Modal) */}
            {confirmModal.isOpen && (
                <ModalOverlay onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#fff', textAlign: 'center' }}>
                        Xác nhận thao tác
                    </h3>
                    <p style={{ textAlign: 'center', marginBottom: '24px', lineHeight: '1.5' }}>
                        Bạn có chắc chắn muốn <strong style={{color: confirmModal.actionType === 'DELETE' ? '#ff4d4f' : '#faad14'}}>{confirmModal.actionDesc}</strong> mã cổ phiếu 
                        <span style={{ color: '#1890ff', fontWeight: 'bold' }}> {confirmModal.ticker}</span> không?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button 
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            style={{ padding: '8px 20px', borderRadius: '4px', border: '1px solid #555', backgroundColor: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Từ chối
                        </button>
                        <button 
                            onClick={executeConfirmAction}
                            style={{ padding: '8px 20px', borderRadius: '4px', border: 'none', backgroundColor: confirmModal.actionType === 'DELETE' ? '#ff4d4f' : '#1890ff', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Đồng ý Thực thi
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Chi Tiết Cổ Phiếu */}
            {detailModal.isOpen && detailModal.stock && (
                <ModalOverlay onClose={() => setDetailModal({ isOpen: false, stock: null })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '12px', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, color: '#08979c' }}>CHI TIẾT MÃ CỔ PHIẾU</h3>
                        <button 
                            onClick={() => setDetailModal({ isOpen: false, stock: null })}
                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Mã CP:</span>
                            <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{detailModal.stock.ticker}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Công ty:</span>
                            <span style={{ fontWeight: 'bold' }}>{detailModal.stock.companyName}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Sàn niêm yết:</span>
                            <span>{detailModal.stock.exchange}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Giá Tham Chiếu (Base):</span>
                            <span>{detailModal.stock.referencePrice?.toLocaleString('vi-VN')} đ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', paddingTop: '10px' }}>
                            <span style={{ color: '#888' }}>Giá Hiện Tại:</span>
                            <span style={{ color: '#faad14', fontWeight: 'bold' }}>{detailModal.stock.currentPrice?.toLocaleString('vi-VN')} đ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Thay đổi:</span>
                            <span style={{ color: detailModal.stock.change >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
                                {detailModal.stock.change > 0 ? '+' : ''}{detailModal.stock.change?.toLocaleString('vi-VN')} 
                                ({detailModal.stock.changePercent > 0 ? '+' : ''}{detailModal.stock.changePercent}%)
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>KLGD (Volume):</span>
                            <span>{detailModal.stock.volume?.toLocaleString('vi-VN')} CP</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', paddingTop: '10px' }}>
                            <span style={{ color: '#888' }}>Trạng thái:</span>
                            <span style={{ fontWeight: 'bold', color: (detailModal.stock.active ?? detailModal.stock.isActive) ? '#52c41a' : '#ff4d4f' }}>
                                {(detailModal.stock.active ?? detailModal.stock.isActive) ? 'Đang Giao Dịch' : 'Ngừng Giao Dịch (Đã Xoá)'}
                            </span>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Form Thêm / Sửa */}
            {stockModal.isOpen && (
                <ModalOverlay onClose={() => setStockModal({ ...stockModal, isOpen: false })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '12px', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, color: stockModal.isEdit ? '#1890ff' : '#52c41a' }}>
                            {stockModal.isEdit ? 'Chỉnh sửa Cổ Phiếu' : 'Thêm Cổ Phiếu Mới'}
                        </h3>
                        <button 
                            onClick={() => setStockModal({ ...stockModal, isOpen: false })}
                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}
                        >✕</button>
                    </div>
                    
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Mã Cổ Phiếu (Ticker) *</label>
                            <input 
                                type="text" 
                                required 
                                value={formData.ticker}
                                onChange={e => setFormData({...formData, ticker: e.target.value.toUpperCase()})}
                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none' }}
                                placeholder="VD: VNM"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Tên Công Ty *</label>
                            <input 
                                type="text" 
                                required 
                                value={formData.companyName}
                                onChange={e => setFormData({...formData, companyName: e.target.value})}
                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none' }}
                                placeholder="VD: Vinamilk"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Sàn Giao Dịch</label>
                            <select 
                                value={formData.exchange}
                                onChange={e => setFormData({...formData, exchange: e.target.value})}
                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none' }}
                            >
                                <option value="HOSE">HOSE</option>
                                <option value="HNX">HNX</option>
                                <option value="UPCOM">UPCOM</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Giá Tham Chiếu / Cơ Sở (VND) *</label>
                            <input 
                                type="number" 
                                required 
                                value={formData.basePrice}
                                onChange={e => setFormData({...formData, basePrice: e.target.value})}
                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none' }}
                                placeholder="VD: 78000"
                            />
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                            <button 
                                type="button"
                                onClick={() => setStockModal({ ...stockModal, isOpen: false })}
                                style={{ padding: '8px 20px', borderRadius: '4px', border: '1px solid #555', backgroundColor: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Huỷ
                            </button>
                            <button 
                                type="submit"
                                style={{ padding: '8px 20px', borderRadius: '4px', border: 'none', backgroundColor: stockModal.isEdit ? '#1890ff' : '#52c41a', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Lưu Lại
                            </button>
                        </div>
                    </form>
                </ModalOverlay>
            )}
        </div>
    );
};

export default AdminStocksPage;

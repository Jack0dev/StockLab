import { useState, useEffect } from 'react';
import { adminAPI } from '@/infrastructure/repositories/api';
import './AdminUsersPage.css';

const ModalOverlay = ({ children, onClose }) => (
    <div className="admin-modal-backdrop" onClick={onClose}>
        <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const AdminUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, userId: null, actionDesc: '', username: '' });
    const [detailModal, setDetailModal] = useState({ isOpen: false, user: null });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await adminAPI.getAllUsers();
            if (response.data.success) {
                setUsers(response.data.data);
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi khi tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeRole = async (userId, newRole) => {
        if (!window.confirm(`Bạn có chắc muốn cấp quyền ${newRole} cho người dùng này?`)) return;
        
        try {
            const response = await adminAPI.changeUserRole(userId, newRole);
            if (response.data.success) {
                alert(response.data.message);
                fetchUsers();
            } else {
                alert(response.data.message);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi cấp quyền');
        }
    };

    const requestToggleLock = (user) => {
        const isUserActive = user.active !== undefined ? user.active : user.isActive;
        const actionDesc = isUserActive ? 'khoá' : 'mở khoá';
        setConfirmModal({
            isOpen: true,
            userId: user.id,
            actionDesc: actionDesc,
            username: user.username
        });
    };

    const executeToggleLock = async () => {
        const userId = confirmModal.userId;
        setConfirmModal({ isOpen: false, userId: null, actionDesc: '', username: '' });
        
        try {
            const response = await adminAPI.toggleUserLock(userId);
            if (response.data.success) {
                alert(response.data.message);
                fetchUsers();
            } else {
                alert(response.data.message);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi thay đổi trạng thái');
        }
    };

    // Lọc user
    const filteredUsers = users.filter(user => {
        const isUserActive = user.active !== undefined ? user.active : user.isActive;
        const matchSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchRole = filterRole === 'ALL' || user.role === filterRole;
        const matchStatus = filterStatus === 'ALL' || 
                            (filterStatus === 'ACTIVE' && isUserActive) || 
                            (filterStatus === 'LOCKED' && !isUserActive);
        
        return matchSearch && matchRole && matchStatus;
    });

    const formatDate = (dateData) => {
        if (!dateData) return '—';
        if (Array.isArray(dateData)) {
            const [y, m, d, h, min] = dateData;
            return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y} ${h.toString().padStart(2, '0')}:${min?.toString().padStart(2, '0') || '00'}`;
        }
        return new Date(dateData).toLocaleString('vi-VN');
    };

    if (loading) {
        return (
            <div className="admin-users-page">
                <div className="spinner" style={{ margin: '80px auto' }}></div>
            </div>
        );
    }

    return (
        <div className="admin-users-page">
            {/* Header */}
            <div className="admin-users-header">
                <div>
                    <span className="admin-users-kicker">Phân hệ Quản trị hệ thống</span>
                    <h1 className="admin-users-title">Quản lý Tài khoản & Phân quyền</h1>
                    <p className="admin-users-sub">
                        Kiểm soát danh tính, phân bổ vai trò quyền hạn (USER, MANAGER, ADMIN) và quản trị trạng thái khóa tài khoản người dùng trên nền tảng.
                    </p>
                </div>
            </div>
            
            {/* Bộ lọc và Tìm kiếm */}
            <div className="admin-users-toolbar">
                <input 
                    type="text" 
                    placeholder="Tìm theo username, họ tên, email..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="admin-search-input"
                />
                
                <select 
                    value={filterRole} 
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="admin-filter-select"
                >
                    <option value="ALL">Tất cả vai trò</option>
                    <option value="USER">USER (Người dùng)</option>
                    <option value="MANAGER">MANAGER (Điều hành)</option>
                    <option value="ADMIN">ADMIN (Quản trị viên)</option>
                </select>

                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="admin-filter-select"
                >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="LOCKED">Đã khóa</option>
                </select>
            </div>

            {error && <div style={{ color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>{error}</div>}
            
            <div className="admin-users-card">
                <div className="admin-users-table-scroll">
                    <table className="admin-users-table">
                        <thead>
                            <tr>
                                <th style={{ width: '60px' }}>ID</th>
                                <th>Thông tin tài khoản</th>
                                <th>Họ và tên</th>
                                <th>Email</th>
                                <th className="th-right">Số dư khả dụng</th>
                                <th>Vai trò</th>
                                <th>Trạng thái</th>
                                <th className="th-center" style={{ width: '160px' }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const isUserActive = user.active !== undefined ? user.active : user.isActive;
                                const roleClass = user.role === 'ADMIN' ? 'role-select-admin' : (user.role === 'MANAGER' ? 'role-select-manager' : 'role-select-user');
                                return (
                                    <tr key={user.id} className={user.role === 'ADMIN' ? 'row-admin' : ''}>
                                        <td className="id-cell mono-num">#{user.id}</td>
                                        <td>
                                            <div className="user-cell-wrap">
                                                <span className="user-uname">{user.username}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="user-fullname">{user.fullName || '—'}</span>
                                        </td>
                                        <td className="text-muted">{user.email}</td>
                                        <td className="th-right tabular-num font-bold text-bullish">
                                            {user.balance?.toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleChangeRole(user.id, e.target.value)}
                                                className={`role-select-box ${roleClass}`}
                                            >
                                                <option value="USER">USER</option>
                                                <option value="MANAGER">MANAGER</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                        </td>
                                        <td>
                                            {isUserActive ? (
                                                <span className="status-indicator-tag status-active">
                                                    Hoạt động
                                                </span>
                                            ) : (
                                                <span className="status-indicator-tag status-locked">
                                                    Đã khóa
                                                </span>
                                            )}
                                        </td>
                                        <td className="th-center">
                                            <div className="user-actions-group">
                                                <button 
                                                    onClick={() => setDetailModal({ isOpen: true, user: user })}
                                                    className="btn-action-sm btn-detail"
                                                    title="Xem thông tin chi tiết"
                                                >
                                                    Chi tiết
                                                </button>
                                                
                                                {user.role !== 'ADMIN' && (
                                                    <button 
                                                        onClick={() => requestToggleLock(user)}
                                                        className={`btn-action-sm ${isUserActive ? 'btn-lock' : 'btn-unlock'}`}
                                                    >
                                                        {isUserActive ? 'Khóa' : 'Mở khóa'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="admin-empty-state">
                        Không tìm thấy người dùng nào phù hợp với điều kiện tìm kiếm.
                    </div>
                )}
            </div>

            {/* Modal Xác nhận Khoá/Mở khoá */}
            {confirmModal.isOpen && (
                <ModalOverlay onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                    <div className="admin-modal-header">
                        <h3 className="admin-modal-title">Xác nhận điều chỉnh tài khoản</h3>
                        <button className="admin-modal-close" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>✕</button>
                    </div>
                    <p style={{ margin: '0 0 1.5rem', lineHeight: '1.6', fontSize: '0.925rem', color: '#475569' }}>
                        Bạn có chắc chắn muốn <strong style={{ color: '#090d16' }}>{confirmModal.actionDesc}</strong> tài khoản 
                        <strong style={{ color: '#090d16' }}> {confirmModal.username}</strong> không?
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
                            onClick={executeToggleLock}
                            className={`btn-action-sm ${confirmModal.actionDesc === 'khoá' ? 'btn-lock' : 'btn-unlock'}`}
                            style={{ padding: '0.5rem 1.25rem' }}
                        >
                            Xác nhận {confirmModal.actionDesc}
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Chi tiết Hồ sơ User */}
            {detailModal.isOpen && detailModal.user && (
                <ModalOverlay onClose={() => setDetailModal({ isOpen: false, user: null })}>
                    <div className="admin-modal-header">
                        <h3 className="admin-modal-title">Hồ sơ người dùng</h3>
                        <button className="admin-modal-close" onClick={() => setDetailModal({ isOpen: false, user: null })}>✕</button>
                    </div>
                    
                    <div className="admin-modal-detail-list">
                        <div className="admin-modal-row">
                            <span className="modal-label">Mã định danh (ID)</span>
                            <span className="modal-val mono-num">#{detailModal.user.id}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Tên tài khoản</span>
                            <span className="modal-val">{detailModal.user.username}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Họ và tên</span>
                            <span className="modal-val">{detailModal.user.fullName || 'Chưa cập nhật'}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Địa chỉ email</span>
                            <span className="modal-val">{detailModal.user.email}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Số điện thoại</span>
                            <span className="modal-val">{detailModal.user.phone || 'Chưa cập nhật'}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Số dư khả dụng</span>
                            <span className="modal-val text-bullish tabular-num">
                                {detailModal.user.balance?.toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Vai trò quản trị</span>
                            <span className="modal-val">{detailModal.user.role}</span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Trạng thái tài khoản</span>
                            <span className="modal-val">
                                {(detailModal.user.active ?? detailModal.user.isActive) ? 'Đang hoạt động' : 'Đã khóa'}
                            </span>
                        </div>
                        <div className="admin-modal-row">
                            <span className="modal-label">Ngày tạo tài khoản</span>
                            <span className="modal-val">{formatDate(detailModal.user.createdAt)}</span>
                        </div>
                    </div>

                    <div className="admin-modal-actions">
                        <button 
                            onClick={() => setDetailModal({ isOpen: false, user: null })}
                            className="btn-action-sm btn-detail"
                            style={{ padding: '0.5rem 1.25rem' }}
                        >
                            Đóng cửa sổ
                        </button>
                    </div>
                </ModalOverlay>
            )}
        </div>
    );
};

export default AdminUsersPage;

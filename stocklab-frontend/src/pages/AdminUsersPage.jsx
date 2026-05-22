import { useState, useEffect } from 'react';
import { adminAPI } from '../api/api';

const ModalOverlay = ({ children, onClose }) => (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#1f1f1f', padding: '24px', borderRadius: '8px',
            width: '450px', maxWidth: '90%', border: '1px solid #333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', color: '#fff'
        }}>
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
        if (!dateData) return '-';
        if (Array.isArray(dateData)) {
            // [year, month, day, hour, minute, second]
            const [y, m, d, h, min, s] = dateData;
            return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y} ${h.toString().padStart(2, '0')}:${min?.toString().padStart(2, '0') || '00'}`;
        }
        return new Date(dateData).toLocaleString('vi-VN');
    };

    if (loading) return <div className="spinner" style={{ margin: '50px auto' }}></div>;

    return (
        <div style={{ padding: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Quản lý Người dùng</h2>
            </div>
            
            {/* Bộ lọc và Tìm kiếm */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    placeholder="Tìm theo username, email, họ tên..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, minWidth: '250px', padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none' }}
                />
                
                <select 
                    value={filterRole} 
                    onChange={(e) => setFilterRole(e.target.value)}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="ALL">Tất cả quyền</option>
                    <option value="USER">USER</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="ADMIN">ADMIN</option>
                </select>

                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#141414', color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="LOCKED">Đã khoá</option>
                </select>
            </div>

            {error && <div style={{ color: '#ff4d4f', marginBottom: '15px' }}>{error}</div>}
            
            <div style={{ overflowX: 'auto', backgroundColor: '#141414', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#1f1f1f', borderBottom: '1px solid #333' }}>
                            <th style={{ padding: '16px' }}>ID</th>
                            <th style={{ padding: '16px' }}>Tên đăng nhập</th>
                            <th style={{ padding: '16px' }}>Họ Tên</th>
                            <th style={{ padding: '16px' }}>Email</th>
                            <th style={{ padding: '16px' }}>Số dư (VND)</th>
                            <th style={{ padding: '16px' }}>Quyền</th>
                            <th style={{ padding: '16px' }}>Trạng thái</th>
                            <th style={{ padding: '16px', textAlign: 'center' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => {
                            const isUserActive = user.active !== undefined ? user.active : user.isActive;
                            return (
                                <tr key={user.id} style={{ 
                                    borderBottom: '1px solid #333', 
                                    transition: 'background-color 0.3s',
                                    backgroundColor: user.role === 'ADMIN' ? 'rgba(255, 77, 79, 0.05)' : 'transparent',
                                    borderLeft: user.role === 'ADMIN' ? '4px solid #ff4d4f' : '4px solid transparent'
                                }}>
                                    <td style={{ padding: '16px' }}>{user.id}</td>
                                    <td style={{ padding: '16px', fontWeight: 'bold' }}>{user.username}</td>
                                    <td style={{ padding: '16px' }}>{user.fullName || '-'}</td>
                                    <td style={{ padding: '16px', color: '#888' }}>{user.email}</td>
                                    <td style={{ padding: '16px', color: '#389e0d' }}>
                                        {user.balance?.toLocaleString('vi-VN')} đ
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleChangeRole(user.id, e.target.value)}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: '#1f1f1f',
                                                color: user.role === 'ADMIN' ? '#ff4d4f' : (user.role === 'MANAGER' ? '#faad14' : '#1890ff'),
                                                border: '1px solid #333',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            <option value="USER" style={{ color: '#1890ff' }}>USER</option>
                                            <option value="MANAGER" style={{ color: '#faad14' }}>MANAGER</option>
                                            <option value="ADMIN" style={{ color: '#ff4d4f' }}>ADMIN</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {isUserActive ? (
                                            <span style={{ color: '#52c41a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#52c41a' }}></div>
                                                Hoạt động
                                            </span>
                                        ) : (
                                            <span style={{ color: '#ff4d4f', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4d4f' }}></div>
                                                Bị khoá
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button 
                                                onClick={() => setDetailModal({ isOpen: true, user: user })}
                                                style={{ 
                                                    padding: '6px 12px', 
                                                    backgroundColor: '#1890ff', 
                                                    color: '#fff', 
                                                    border: 'none', 
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                Chi tiết
                                            </button>
                                            
                                            {user.role !== 'ADMIN' && (
                                                <button 
                                                    onClick={() => requestToggleLock(user)}
                                                    style={{ 
                                                        padding: '6px 12px', 
                                                        backgroundColor: isUserActive ? '#ff4d4f' : '#52c41a', 
                                                        color: '#fff', 
                                                        border: 'none', 
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {isUserActive ? 'Khoá' : 'Mở khoá'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredUsers.length === 0 && (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                        Không tìm thấy người dùng nào phù hợp.
                    </div>
                )}
            </div>

            {/* Modal Xác nhận Khoá/Mở khoá */}
            {confirmModal.isOpen && (
                <ModalOverlay onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#fff', textAlign: 'center' }}>
                        Xác nhận thao tác
                    </h3>
                    <p style={{ textAlign: 'center', marginBottom: '24px', lineHeight: '1.5' }}>
                        Bạn có chắc chắn muốn <strong>{confirmModal.actionDesc}</strong> tài khoản 
                        <span style={{ color: '#1890ff', fontWeight: 'bold' }}> {confirmModal.username}</span> không?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button 
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            style={{ padding: '8px 20px', borderRadius: '4px', border: '1px solid #555', backgroundColor: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Huỷ
                        </button>
                        <button 
                            onClick={executeToggleLock}
                            style={{ padding: '8px 20px', borderRadius: '4px', border: 'none', backgroundColor: '#1890ff', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Đồng ý
                        </button>
                    </div>
                </ModalOverlay>
            )}

            {/* Modal Chi tiết Hồ sơ User */}
            {detailModal.isOpen && detailModal.user && (
                <ModalOverlay onClose={() => setDetailModal({ isOpen: false, user: null })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '12px', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, color: '#1890ff' }}>Hồ sơ người dùng</h3>
                        <button 
                            onClick={() => setDetailModal({ isOpen: false, user: null })}
                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>ID:</span>
                            <span style={{ fontWeight: 'bold' }}>{detailModal.user.id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Tên đăng nhập:</span>
                            <span style={{ fontWeight: 'bold' }}>{detailModal.user.username}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Họ và tên:</span>
                            <span style={{ fontWeight: 'bold' }}>{detailModal.user.fullName || 'Chưa cập nhật'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Email:</span>
                            <span>{detailModal.user.email}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Số điện thoại:</span>
                            <span>{detailModal.user.phone || 'Chưa cập nhật'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Số dư hiện tại:</span>
                            <span style={{ color: '#389e0d', fontWeight: 'bold' }}>
                                {detailModal.user.balance?.toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Quyền hạn:</span>
                            <span style={{ color: detailModal.user.role === 'ADMIN' ? '#ff4d4f' : '#1890ff', fontWeight: 'bold' }}>
                                {detailModal.user.role}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Trạng thái:</span>
                            <span style={{ fontWeight: 'bold', color: (detailModal.user.active ?? detailModal.user.isActive) ? '#52c41a' : '#ff4d4f' }}>
                                {(detailModal.user.active ?? detailModal.user.isActive) ? 'Đang hoạt động' : 'Bị khoá'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Ngày tham gia:</span>
                            <span>{formatDate(detailModal.user.createdAt)}</span>
                        </div>
                    </div>
                </ModalOverlay>
            )}
        </div>
    );
};

export default AdminUsersPage;

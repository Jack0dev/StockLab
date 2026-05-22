import { Navigate, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = () => {
    const { user, isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    // Nếu chưa đăng nhập, chuyển hướng về trang đăng nhập
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Nếu đã đăng nhập nhưng không phải ADMIN, hiển thị màn hình thông báo lỗi
    if (user?.role !== 'ADMIN') {
        return (
            <div style={{ padding: '50px', textAlign: 'center', color: '#fff', backgroundColor: '#141414', minHeight: '100vh' }}>
                <h1 style={{ color: '#ff4d4f', fontSize: '3rem', marginBottom: '10px' }}>403</h1>
                <h2 style={{ marginBottom: '20px' }}>Từ chối truy cập</h2>
                <h3 style={{ fontWeight: 'normal', marginBottom: '30px' }}>Bạn không có quyền truy cập vào trang Admin định tuyến này.</h3>
                <Link to="/" style={{ padding: '10px 20px', backgroundColor: '#1890ff', color: '#fff', textDecoration: 'none', borderRadius: '4px' }}>
                    Quay lại trang chủ
                </Link>
            </div>
        );
    }

    return <Outlet />;
};

export default AdminRoute;

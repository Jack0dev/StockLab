import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { vnpayAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './VnPayResultPage.css';

export default function VnPayResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchUserProfile } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Chuyển tất cả query params sang object
        const params = {};
        searchParams.forEach((value, key) => {
          params[key] = value;
        });

        const res = await vnpayAPI.getResult(params);
        if (res.data.success) {
          setResult({ success: true, ...res.data.data });
          // Cập nhật số dư
          if (fetchUserProfile) await fetchUserProfile();
        } else {
          setResult({ success: false, message: res.data.message });
        }
      } catch (err) {
        setError('Không thể xác minh giao dịch. Vui lòng kiểm tra lịch sử giao dịch.');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN').format(amount || 0);

  if (loading) {
    return (
      <div className="vnpay-result-container">
        <div className="vnpay-result-card loading-card">
          <div className="spinner-lg"></div>
          <h2>Đang xác minh giao dịch...</h2>
          <p>Vui lòng đợi trong giây lát</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vnpay-result-container">
        <div className="vnpay-result-card error-card">
          <div className="result-icon error">✕</div>
          <h2>Lỗi xác minh</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/wallet')}>
            Quay về Ví
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vnpay-result-container">
      <div className={`vnpay-result-card ${result?.success ? 'success-card' : 'failed-card'}`}>
        {/* Icon */}
        <div className={`result-icon ${result?.success ? 'success' : 'error'}`}>
          {result?.success ? '✓' : '✕'}
        </div>

        {/* Title */}
        <h2>{result?.success ? 'Thanh toán thành công!' : 'Thanh toán không thành công'}</h2>
        <p className="result-subtitle">
          {result?.success
            ? 'Tiền đã được cộng vào tài khoản của bạn'
            : result?.message || 'Giao dịch bị hủy hoặc gặp lỗi'}
        </p>

        {/* Transaction details */}
        {result?.success && (
          <div className="result-details">
            <div className="detail-row">
              <span className="detail-label">Số tiền</span>
              <span className="detail-value amount">+{formatCurrency(result.amount)}₫</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Mã giao dịch</span>
              <span className="detail-value">{result.txnRef}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Ngân hàng</span>
              <span className="detail-value">{result.bankCode}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Mã GD VNPay</span>
              <span className="detail-value">{result.transactionNo}</span>
            </div>
            {result.payDate && (
              <div className="detail-row">
                <span className="detail-label">Thời gian</span>
                <span className="detail-value">
                  {result.payDate.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$3/$2/$1 $4:$5:$6')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => navigate('/wallet')}>
            {result?.success ? 'Xem Ví của tôi' : 'Thử lại'}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/stocks')}>
            Tiếp tục giao dịch
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { vnpayAPI } from '@/infrastructure/repositories/api';
import { useAuth } from '@/infrastructure/context/AuthContext';
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
        const params = {};
        searchParams.forEach((value, key) => {
          params[key] = value;
        });

        const res = await vnpayAPI.getResult(params);
        if (res.data.success) {
          setResult({ success: true, ...res.data.data });
          if (fetchUserProfile) await fetchUserProfile();
        } else {
          setResult({ success: false, message: res.data.message });
        }
      } catch (err) {
        setError('Không thể xác minh giao dịch. Vui lòng kiểm tra lịch sử ví.');
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
      <div className="vnpay-receipt-viewport fade-in">
        <div className="vnpay-receipt-card loading-state">
          <div className="receipt-spinner"></div>
          <h2 className="loading-title">Đang Xác Minh Giao Dịch</h2>
          <p className="loading-desc">Hệ thống đang đồng bộ dữ liệu với cổng VNPay Sandbox, vui lòng chờ trong giây lát...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vnpay-receipt-viewport fade-in">
        <div className="vnpay-receipt-card error-state">
          <span className="receipt-kicker text-bearish">LỖI XÁC MINH</span>
          <h2 className="receipt-title">Không Thể Xác Thực</h2>
          <p className="receipt-subtitle">{error}</p>
          <div className="receipt-actions">
            <button className="btn btn-primary btn-block" onClick={() => navigate('/wallet')}>
              Quay Về Quản Lý Ví
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSuccess = result?.success;

  return (
    <div className="vnpay-receipt-viewport fade-in">
      <div className={`vnpay-receipt-card ${isSuccess ? 'card-success' : 'card-failed'}`}>
        {/* Header Badge */}
        <div className="receipt-header-row">
          <span className="receipt-kicker">BIÊN LAI ĐIỆN TỬ</span>
          <span className={`receipt-badge ${isSuccess ? 'badge-success' : 'badge-failed'}`}>
            {isSuccess ? 'THÀNH CÔNG' : 'KHÔNG THÀNH CÔNG'}
          </span>
        </div>

        <h2 className="receipt-title">
          {isSuccess ? 'Ký Quỹ Thành Công' : 'Thanh Toán Bị Gián Đoạn'}
        </h2>
        
        <p className="receipt-subtitle">
          {isSuccess
            ? 'Khoản tiền đã được ghi có tức thì vào số dư khả dụng của bạn.'
            : (result?.message || 'Giao dịch bị huỷ hoặc có lỗi phát sinh từ cổng ngân hàng.')}
        </p>

        {isSuccess && result?.amount && (
          <div className="receipt-amount-banner">
            <span className="amount-label">Số tiền ghi có</span>
            <div className="amount-val text-bullish tabular-num">
              +{formatCurrency(result.amount)} <span className="curr-unit">VND</span>
            </div>
          </div>
        )}

        {/* Breakdown table */}
        {isSuccess && (
          <div className="receipt-breakdown">
            <div className="breakdown-row">
              <span className="b-label">Mã giao dịch</span>
              <span className="b-val mono-num">{result.txnRef}</span>
            </div>
            <div className="breakdown-row">
              <span className="b-label">Cổng thanh toán</span>
              <span className="b-val">VNPay Sandbox</span>
            </div>
            {result.bankCode && (
              <div className="breakdown-row">
                <span className="b-label">Ngân hàng phát hành</span>
                <span className="b-val">{result.bankCode}</span>
              </div>
            )}
            {result.transactionNo && (
              <div className="breakdown-row">
                <span className="b-label">Mã tham chiếu VNPay</span>
                <span className="b-val mono-num">{result.transactionNo}</span>
              </div>
            )}
            {result.payDate && (
              <div className="breakdown-row">
                <span className="b-label">Thời gian hoàn tất</span>
                <span className="b-val tabular-num">
                  {result.payDate.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$3/$2/$1 $4:$5:$6')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action CTAs */}
        <div className="receipt-actions">
          <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/wallet')}>
            {isSuccess ? 'Xem Số Dư & Quản Lý Ví →' : 'Thử Lại Giao Dịch Mới'}
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/stocks')}>
            Chuyển Đến Bảng Giá Chứng Khoán
          </button>
        </div>
      </div>
    </div>
  );
}

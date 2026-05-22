import React, { useState } from 'react';
import { exportAPI } from '../api/api';
import './ReportPage.css'; // Sẽ tạo style sau

const ReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDownloadExcel = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await exportAPI.exportTransactions();
      
      // Khởi tạo download từ luồng Blob
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'LichSuGiaoDich_StockLab.xlsx'); 
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi khi tải file', err);
      setError('Đã xảy ra lỗi hệ thống khi chuẩn bị báo cáo của bạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-container">
      <h2>📊 Trung Tâm Xuất Báo Cáo Tài Chính</h2>
      <p className="report-subtext">Kết xuất dữ liệu giao dịch dưới dạng file tính toán để tiện lưu trữ hoặc phân tích bên ngoài.</p>
      
      {error && <div className="error-alert">{error}</div>}

      <div className="report-card">
        <div className="report-card-content">
          <h3>1. Lịch sử giao dịch (Excel)</h3>
          <p>Bao gồm toàn bộ các lệnh mua/bán đã thực hiện thành công, kèm theo số lượng, mức giá và tổng tiền từng lệnh.</p>
        </div>
        <button 
            className="download-btn excel-btn" 
            onClick={handleDownloadExcel} 
            disabled={loading}
        >
          {loading ? 'Đang chuẩn bị...' : '⬇️ Xuất File Excel'}
        </button>
      </div>

      <div className="report-card disabled">
        <div className="report-card-content">
          <h3>2. Báo cáo biến động tài sản (PDF) <span className="beta-badge">Comming Soon</span></h3>
          <p>Trích xuất chi tiết tỷ trọng danh mục hiện tại bằng biểu đồ trực quan.</p>
        </div>
        <button className="download-btn pdf-btn" disabled>
          ⬇️ Xuất File PDF
        </button>
      </div>
    </div>
  );
};

export default ReportPage;

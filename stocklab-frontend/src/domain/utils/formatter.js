/**
 * Domain Utilities: Formatters & Color Resolvers
 * 100% Pure Functions — No side effects, fully null-safe
 */

/**
 * Định dạng thị giá / số tiền theo chuẩn vi-VN (VD: 25,000)
 */
export function formatPrice(price, fallback = '0') {
  if (price === null || price === undefined || price === '') return fallback;
  const num = Number(price);
  if (isNaN(num)) return fallback;
  return num.toLocaleString('vi-VN');
}

/**
 * Định dạng khối lượng cổ phiếu (VD: 1,500)
 */
export function formatVolume(volume, fallback = '0') {
  if (volume === null || volume === undefined || volume === '') return fallback;
  const num = Number(volume);
  if (isNaN(num)) return fallback;
  return num.toLocaleString('vi-VN');
}

/**
 * Định dạng khối lượng dạng rút gọn (VD: 1.25 tr, 50.0 k)
 */
export function formatCompactVolume(vol) {
  if (!vol) return '0';
  const num = Number(vol);
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + ' tr';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + ' k';
  return num.toLocaleString('vi-VN');
}

/**
 * Định dạng phần trăm tăng giảm (VD: +2.50%, -1.15%)
 */
export function formatPercent(percent, decimals = 2) {
  if (percent === null || percent === undefined) return '0.00%';
  const num = Number(percent);
  if (isNaN(num)) return '0.00%';
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(decimals)}%`;
}

/**
 * Định dạng ngày giờ chuẩn Việt Nam (dd/MM/yyyy HH:mm)
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Bảng màu nhận diện mã cổ phiếu bằng thuật toán hash chuỗi
 */
export function getTickerColor(ticker) {
  if (!ticker) return '#2962ff';
  const colors = [
    '#2962ff', '#00c853', '#ff6d00', '#aa00ff',
    '#d50000', '#00bfa5', '#6200ea', '#c51162',
  ];
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Lấy nhãn hiển thị trạng thái lệnh bằng tiếng Việt
 */
export function getStatusLabel(status) {
  const map = {
    PENDING_TRIGGER: 'Chờ kích hoạt',
    ACTIVE: 'Chờ khớp',
    PARTIALLY_FILLED: 'Khớp 1 phần',
    FILLED: 'Đã khớp',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Hết hạn',
    REJECTED: 'Từ chối',
  };
  return map[status] || status || '';
}

/**
 * Lấy CSS class tương ứng với trạng thái lệnh
 */
export function getStatusClass(status) {
  const map = {
    PENDING_TRIGGER: 'pending',
    ACTIVE: 'pending',
    PARTIALLY_FILLED: 'partial',
    FILLED: 'filled',
    CANCELLED: 'cancelled',
    EXPIRED: 'cancelled',
    REJECTED: 'rejected',
  };
  return map[status] || '';
}

/**
 * Lấy CSS class dạng badge cho trạng thái lệnh (VD: status-pending, status-filled)
 */
export function getStatusBadgeClass(status) {
  const c = getStatusClass(status);
  return c ? `status-${c}` : '';
}

/**
 * Lấy CSS class theo biến động giá (tăng/giảm/tham chiếu)
 */
export function getPriceClass(change) {
  if (change === null || change === undefined) return 'price-ref';
  const num = Number(change);
  if (isNaN(num) || num === 0) return 'price-ref';
  return num > 0 ? 'price-up' : 'price-down';
}

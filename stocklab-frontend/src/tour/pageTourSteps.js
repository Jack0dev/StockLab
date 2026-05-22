/**
 * pageTourSteps.js
 * Định nghĩa tập trung tất cả steps tour cho từng trang.
 * Mỗi step: { selector, title, description, position }
 * selector: CSS selector của element cần highlight (null = modal giữa màn hình)
 */

export const PAGE_TOUR_STEPS = {

  // ─── Bảng Giá ─────────────────────────────────────────
  stocks: [
    {
      selector: '.stock-list-header h2',
      title: '📊 Bảng Giá Chứng Khoán',
      description: 'Trang này hiển thị toàn bộ cổ phiếu trên thị trường với giá cập nhật liên tục (real-time). Biểu tượng 🟢 LIVE cho biết dữ liệu đang được cập nhật tự động.',
      position: 'bottom',
    },
    {
      selector: '.exchange-filter',
      title: '🏦 Lọc theo Sàn',
      description: 'Chọn sàn giao dịch muốn xem: Tất cả, HOSE (TP.HCM), HNX (Hà Nội) hoặc UPCOM. Giúp bạn tập trung vào nhóm cổ phiếu quan tâm.',
      position: 'bottom',
    },
    {
      selector: '.stock-table-wrapper',
      title: '📋 Bảng Giá Real-time',
      description: 'Mỗi hàng là một cổ phiếu. Màu xanh = tăng giá, đỏ = giảm giá, vàng = tham chiếu. Các cột gồm: Giá hiện tại, Giá tham chiếu, Cao/Thấp nhất, Khối lượng và % thay đổi.\n\nClick vào bất kỳ hàng nào để xem chi tiết và biểu đồ.',
      position: 'bottom',
    },
    {
      selector: '.stock-pagination',
      title: '📄 Phân Trang',
      description: 'Điều hướng giữa các trang. Mỗi trang hiển thị 20 mã cổ phiếu.',
      position: 'bottom',
    },
  ],

  // ─── Chi Tiết Cổ Phiếu ────────────────────────────────
  stockDetail: [
    {
      selector: '.stock-header',
      title: '📈 Thông Tin Cổ Phiếu',
      description: 'Hiển thị tên, mã, sàn giao dịch và giá hiện tại của cổ phiếu. Biểu tượng 🟢 LIVE nghĩa là giá đang cập nhật tự động qua kết nối WebSocket.',
      position: 'bottom',
    },
    {
      selector: '.watchlist-btn',
      title: '⭐ Theo Dõi Cổ Phiếu',
      description: 'Click "Theo dõi" để thêm cổ phiếu này vào danh sách yêu thích. Bạn có thể xem lại nhanh tại mục "Thông Tin Thị Trường" trên navbar.',
      position: 'bottom',
    },
    {
      selector: '.price-info-grid',
      title: '💹 Thông Tin Giá Chi Tiết',
      description: 'Giá tham chiếu (TC) là giá đóng cửa ngày hôm qua — dùng làm mốc tham chiếu. Cột Cao nhất/Thấp nhất là biên độ giá trong ngày hôm nay.',
      position: 'bottom',
    },
    {
      selector: '.range-selector',
      title: '🕯️ Khung Thời Gian Biểu Đồ',
      description: 'Chọn khung thời gian để xem biểu đồ: 1W (1 tuần), 1M (1 tháng), 3M (3 tháng), 6M (6 tháng), 1Y (1 năm). Giúp phân tích xu hướng ngắn và dài hạn.',
      position: 'bottom',
    },
    {
      selector: '.chart-container',
      title: '📊 Biểu Đồ Nến Nhật',
      description: 'Biểu đồ Candlestick thể hiện lịch sử giá: mỗi "nến" là dữ liệu 1 ngày (giá mở cửa, đóng cửa, cao nhất, thấp nhất). Phần dưới là khối lượng giao dịch.',
      position: 'bottom',
    },
  ],

  // ─── Đặt Lệnh ─────────────────────────────────────────
  trading: [
    {
      selector: '.trading-header',
      title: '💰 Tổng Quan Số Dư',
      description: 'Hiển thị tổng tài sản và số dư khả dụng của bạn. Số dư khả dụng = Tổng tài sản trừ đi tiền đang bị giữ bởi các lệnh chờ khớp.',
      position: 'bottom',
    },
    {
      selector: '.trade-tabs',
      title: '🔀 Tab MUA / BÁN',
      description: 'Chọn loại giao dịch:\n• MUA: Tìm và mua cổ phiếu mới\n• BÁN: Chọn từ danh mục đang giữ để bán',
      position: 'bottom',
    },
    {
      selector: '.trading-form-card',
      title: '📝 Form Đặt Lệnh',
      description: 'Tại đây bạn điền thông tin đặt lệnh:\n1. Chọn mã cổ phiếu (gõ để tìm kiếm)\n2. Nhập giá đặt lệnh (hoặc dùng giá hiện tại)\n3. Nhập số lượng cổ phiếu\n4. Xem tóm tắt tổng tiền',
      position: 'bottom',
    },
    {
      selector: '.otp-section',
      title: '🔐 Xác Thực OTP (Khi Bán)',
      description: 'Khi bán cổ phiếu, hệ thống yêu cầu xác thực OTP qua email để bảo mật giao dịch. Click "Gửi mã" → kiểm tra email → nhập mã 6 chữ số.',
      position: 'bottom',
    },
    {
      selector: '.trade-btn',
      title: '🚀 Đặt Lệnh',
      description: 'Sau khi điền đầy đủ thông tin, click nút này để gửi lệnh lên hệ thống. Lệnh sẽ vào trạng thái "Chờ khớp" và tự động khớp khi có người giao dịch đối ứng.',
      position: 'bottom',
    },
    {
      selector: '.trading-sidebar',
      title: '📋 Lệnh Gần Đây & Danh Mục',
      description: 'Sidebar bên phải tóm tắt 5 lệnh gần nhất và danh mục cổ phiếu đang giữ. Giúp bạn theo dõi nhanh mà không cần chuyển trang.',
      position: 'bottom',
    },
  ],

  // ─── Lệnh Điều Kiện ───────────────────────────────────
  conditionalOrder: [
    {
      selector: '.cond-header',
      title: '⚡ Lệnh Điều Kiện',
      description: 'Lệnh điều kiện được đặt trước và tự động kích hoạt khi giá đạt mức bạn đặt. Hữu ích khi không thể theo dõi thị trường liên tục.',
      position: 'bottom',
    },
    {
      selector: '.cond-form-card',
      title: '📋 Các Loại Lệnh Điều Kiện',
      description: 'Hệ thống hỗ trợ 7 loại lệnh:\n• GTD: Lệnh Limit có hiệu lực đến ngày hết hạn\n• Stop: Kích hoạt khi giá chạm mức Stop\n• Stop Limit: Stop kết hợp Limit\n• Trailing Stop: Stop tự động theo giá\n• Trailing Stop Limit: Kết hợp\n• OCO: Một hủy một khi khớp\n• Stop Loss / Take Profit: Cắt lỗ và chốt lời',
      position: 'bottom',
    },
    {
      selector: '.cond-select-wrapper',
      title: '🎯 Chọn Loại Điều Kiện',
      description: 'Click vào đây để chọn loại lệnh phù hợp. Mỗi loại sẽ hiển thị các trường nhập liệu tương ứng bên dưới.',
      position: 'bottom',
    },
    {
      selector: '.otp-section',
      title: '🔐 Xác Thực OTP Bắt Buộc',
      description: 'Lệnh điều kiện yêu cầu OTP để xác nhận. Click "Gửi mã" → nhập mã 6 số từ email trước khi đặt lệnh.',
      position: 'bottom',
    },
  ],

  // ─── Danh Mục Đầu Tư ──────────────────────────────────
  portfolio: [
    {
      selector: '.pf-summary-grid',
      title: '💰 Tổng Quan Tài Sản',
      description: 'Tóm tắt tài sản:\n• Tổng tài sản = giá trị CP + tiền mặt\n• Giá trị CP = tổng giá trị cổ phiếu đang giữ theo giá hiện tại\n• Lãi/Lỗ = chênh lệch so với giá mua vào',
      position: 'bottom',
    },
    {
      selector: '.pf-allocation-section',
      title: '🍩 Biểu Đồ Phân Bổ Tài Sản',
      description: 'Biểu đồ Donut cho thấy tỷ lệ % mỗi mã cổ phiếu trong danh mục. Hover vào từng phần để xem giá trị chi tiết. Giúp bạn đánh giá mức độ đa dạng hóa danh mục.',
      position: 'bottom',
    },
    {
      selector: '.pf-table-wrapper',
      title: '📊 Bảng Cổ Phiếu Đang Giữ',
      description: 'Chi tiết từng mã:\n• Giá TB mua: Giá bình quân bạn đã mua\n• Lãi/Lỗ: tính theo (Giá hiện tại - Giá TB mua) × Số lượng\n\nClick "Bán" để chuyển nhanh sang trang đặt lệnh bán.',
      position: 'bottom',
    },
  ],

  // ─── Sổ Lệnh (Order Book) ─────────────────────────────
  orderBook: [
    {
      selector: '.ob-header',
      title: '📊 Sổ Lệnh (Order Book)',
      description: 'Order Book hiển thị tất cả lệnh mua và bán đang chờ khớp của một mã cổ phiếu tại từng mức giá. Đây là thước đo cung-cầu thực tế trên thị trường.',
      position: 'bottom',
    },
    {
      selector: '.ob-search-section',
      title: '🔍 Tìm Kiếm Mã CP',
      description: 'Nhập mã cổ phiếu cần xem (VD: VNM, FPT, VIC). Hệ thống tự gợi ý khi bạn gõ. Click "Tự động refresh" để cập nhật mỗi 5 giây.',
      position: 'bottom',
    },
    {
      selector: '.ob-bid-side',
      title: '🟢 Bên MUA (BID)',
      description: 'Danh sách lệnh mua đang chờ khớp. Thanh ngang thể hiện khối lượng tương đối. Giá cao nhất ở trên cùng = giá mua tốt nhất.\n\nSố lệnh, Khối lượng tổng, Mức giá.',
      position: 'bottom',
    },
    {
      selector: '.ob-ask-side',
      title: '🔴 Bên BÁN (ASK)',
      description: 'Danh sách lệnh bán đang chờ khớp. Giá thấp nhất ở trên = giá bán tốt nhất. Chênh lệch giữa BID cao nhất và ASK thấp nhất gọi là "spread".',
      position: 'bottom',
    },
    {
      selector: '.ob-summary',
      title: '📈 Tóm Tắt Cung Cầu',
      description: 'So sánh tổng khối lượng mua và bán. Nếu KL mua >> KL bán → áp lực mua lớn, giá có thể tăng. Ngược lại → áp lực bán lớn.',
      position: 'bottom',
    },
  ],

  // ─── Quản Lý Lệnh ─────────────────────────────────────
  orders: [
    {
      selector: '.oh-header',
      title: '✅ Quản Lý Lệnh Đặt',
      description: 'Trang này liệt kê tất cả lệnh bạn đã đặt, kèm trạng thái cập nhật thực tế. Bạn có thể xem chi tiết, sửa hoặc hủy các lệnh đang chờ.',
      position: 'bottom',
    },
    {
      selector: '.oh-filters',
      title: '🔽 Lọc Theo Trạng Thái',
      description: 'Lọc lệnh theo: Tất cả | Chờ khớp | Khớp 1 phần | Đã khớp | Đã hủy | Từ chối. Giúp bạn nhanh chóng tìm lệnh cần xử lý.',
      position: 'bottom',
    },
    {
      selector: '.oh-table-card',
      title: '📋 Bảng Danh Sách Lệnh',
      description: 'Mỗi hàng là một lệnh. Click vào hàng để xem chi tiết đầy đủ (tiến độ khớp, timestamp).\n\nLệnh ở trạng thái "Chờ khớp" hoặc "Khớp 1 phần" có thể:\n• ✏️ Sửa giá/số lượng\n• ❌ Hủy lệnh',
      position: 'bottom',
    },
  ],

  // ─── Lịch Sử Giao Dịch ────────────────────────────────
  transactions: [
    {
      selector: '.tx-header',
      title: '📜 Lịch Sử Giao Dịch',
      description: 'Ghi lại tất cả giao dịch đã KHỚP thành công (khác với Quản lý lệnh — ghi nhận cả lệnh chưa khớp). Đây là bằng chứng giao dịch thực tế.',
      position: 'bottom',
    },
    {
      selector: '.type-filter',
      title: '🔽 Lọc Mua / Bán',
      description: 'Click "Mua" để chỉ xem giao dịch mua, "Bán" để xem giao dịch bán, hoặc "Tất cả" để xem toàn bộ lịch sử.',
      position: 'bottom',
    },
    {
      selector: '.tx-table-wrapper',
      title: '📊 Bảng Lịch Sử',
      description: 'Mỗi dòng là một giao dịch đã khớp:\n• MUA (màu đỏ): tiền ra\n• BÁN (màu xanh): tiền vào\n• Tổng tiền = Giá × Số lượng',
      position: 'bottom',
    },
  ],

  // ─── Ví Tiền ──────────────────────────────────────────
  wallet: [
    {
      selector: '.wallet-sidebar',
      title: '💰 Số Dư Tài Khoản',
      description: 'Hiển thị:\n• Số dư khả dụng: Số tiền có thể dùng ngay\n• Tổng tài sản: Tổng số tiền\n• Tiền bị giữ: Đang khóa bởi lệnh chờ khớp',
      position: 'bottom',
    },
    {
      selector: '.wallet-tabs',
      title: '📑 Tab Nạp / Rút / Lịch Sử',
      description: '3 chức năng chính:\n• Nạp tiền: Tạo lệnh → nhận thông tin chuyển khoản + QR Code\n• Rút tiền: Điền tài khoản ngân hàng + OTP → gửi yêu cầu\n• Lịch sử: Tra cứu tất cả giao dịch nạp/rút',
      position: 'bottom',
    },
    {
      selector: '.wallet-main',
      title: '🏦 Khu Vực Giao Dịch',
      description: 'Nạp tiền:\n1. Nhập số tiền → "Tiếp tục"\n2. Hệ thống tạo mã giao dịch unique\n3. Chuyển khoản theo thông tin hiển thị\n4. Admin duyệt → tiền vào tài khoản\n\nRút tiền: Nhập số tiền + tài khoản NH + OTP qua email.',
      position: 'bottom',
    },
  ],

  // ─── Danh Sách Theo Dõi ───────────────────────────────
  watchlist: [
    {
      selector: '.wl-header',
      title: '⭐ Danh Sách Theo Dõi',
      description: 'Tập hợp các cổ phiếu bạn quan tâm. Để thêm cổ phiếu: vào trang "Bảng Giá" → click vào mã CP → click nút "Theo dõi".',
      position: 'bottom',
    },
    {
      selector: '.wl-grid',
      title: '🗂️ Thẻ Cổ Phiếu',
      description: 'Mỗi thẻ hiển thị giá hiện tại và % thay đổi so với hôm qua.\n• Click vào tên/icon → xem chi tiết & biểu đồ\n• "Giao dịch" → chuyển sang trang đặt lệnh\n• ✕ → bỏ theo dõi',
      position: 'bottom',
    },
  ],

  // ─── Trading Bot ──────────────────────────────────────
  botActivity: [
    {
      selector: '.bot-header',
      title: '🤖 Bot Tạo Thanh Khoản',
      description: 'Bot tự động đặt lệnh mua/bán để duy trì thanh khoản thị trường. Đây giúp các lệnh của bạn dễ được khớp hơn, ngay cả khi thị trường ít người giao dịch.',
      position: 'bottom',
    },
    {
      selector: '.bot-stats-grid',
      title: '📊 Thống Kê Bot',
      description: '4 chỉ số:\n• Trạng thái: Bot đang chạy hay đã dừng\n• Tổng lệnh đã đặt: Từ lúc bot khởi động\n• Tần suất: Khoảng cách giữa 2 lệnh liên tiếp\n• Bot Account: Tên tài khoản bot sử dụng',
      position: 'bottom',
    },
    {
      selector: '.bot-activity-card',
      title: '📋 Lệnh Bot Gần Đây',
      description: 'Danh sách các lệnh bot đã đặt gần đây, cập nhật mỗi 3 giây. Mỗi dòng gồm: thời gian, mã CP, loại MUA/BÁN, số lượng, giá và tổng giá trị.',
      position: 'bottom',
    },
  ],
};

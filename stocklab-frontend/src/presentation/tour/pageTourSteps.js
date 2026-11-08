/**
 * pageTourSteps.js
 * Định nghĩa tập trung tất cả steps tour hướng dẫn cho từng trang trên StockLab.
 * Mỗi step: { selector, title, description, position }
 * selector: CSS selector của element cần highlight (null hoặc không tìm thấy = popup giữa màn hình)
 */

export const PAGE_TOUR_STEPS = {

  // ─── 01. Bảng Giá Chứng Khoán (StockListPage) ─────────
  stocks: [
    {
      selector: '.editorial-telemetry-strip',
      title: '📊 Chỉ Số Thị Trường & Thống Kê',
      description: 'Thanh thông tin cập nhật liên tục biến động VN-INDEX, VN30, HNX-INDEX và cán cân thị trường (số lượng mã Tăng / Giảm / Đứng giá / Tổng khối lượng).',
      position: 'bottom',
    },
    {
      selector: '.exchange-tabs',
      title: '🏦 Lọc Cổ Phiếu Theo Sàn',
      description: 'Chuyển đổi nhanh giữa các sàn giao dịch: Tất cả, HOSE (TP.HCM), HNX (Hà Nội) hoặc UPCOM để lọc cổ phiếu cần theo dõi.',
      position: 'bottom',
    },
    {
      selector: '.strip-right',
      title: '🔍 Tìm Kiếm & Công Cụ Trợ Giúp',
      description: 'Tìm kiếm nhanh mã cổ phiếu theo mã hoặc tên công ty, làm mới dữ liệu và mở lại hướng dẫn này bất cứ lúc nào.',
      position: 'bottom',
    },
    {
      selector: '.light-table-container',
      title: '📋 Bảng Giá Cổ Phiếu Real-time',
      description: 'Mỗi hàng hiển thị thông tin một mã cổ phiếu với giá trần, sàn, tham chiếu và giá khớp trực tuyến.\n\nClick vào bất kỳ hàng nào để xem chi tiết biểu đồ kỹ thuật và đặt lệnh.',
      position: 'top',
    },
    {
      selector: '.table-pager-footer',
      title: '📄 Điều Hướng Phân Trang',
      description: 'Dễ dàng chuyển đổi giữa các trang để theo dõi toàn bộ danh sách cổ phiếu niêm yết trên thị trường.',
      position: 'top',
    },
  ],

  // ─── 02. Chi Tiết Cổ Phiếu (StockDetailPage) ──────────
  stockDetail: [
    {
      selector: '.sd-header',
      title: '📈 Thông Tin Cổ Phiếu & Giá Khớp',
      description: 'Hiển thị tên công ty, mã ticker, sàn niêm yết và thị giá hiện tại. Biểu tượng Live cho biết dữ liệu đang cập nhật tự động qua WebSocket thời gian thực.',
      position: 'bottom',
    },
    {
      selector: '.sd-h-ceil-floor',
      title: '💹 Khung Giá Giao Dịch Trong Ngày',
      description: '• Giá Trần (tím): Mức giá cao nhất có thể đặt mua\n• Giá Sàn (xanh lơ): Mức giá thấp nhất có thể đặt bán\n• Tham Chiếu (vàng): Giá đóng cửa của phiên hôm trước.',
      position: 'bottom',
    },
    {
      selector: '.sd-h-actions',
      title: '⭐ Đặt Lệnh & Theo Dõi',
      description: '• Nút "Đặt lệnh ngay": Chuyển nhanh sang trang giao dịch với mã này\n• Biểu tượng Ngôi sao (★): Thêm/bỏ theo dõi mã vào Watchlist.',
      position: 'bottom',
    },
    {
      selector: '.sd-main-tabs',
      title: '📑 Các Tab Nghiên Cứu Chuyên Sâu',
      description: 'Chuyển đổi giữa: Giao dịch & Sổ lệnh, Biểu đồ kỹ thuật tương tác (MA, RSI, MACD, Kháng cự/Hỗ trợ), Hồ sơ doanh nghiệp, Tin tức tài chính và Báo cáo.',
      position: 'bottom',
    },
  ],

  // ─── 03. Đặt Lệnh Mua / Bán (TradingPage) ─────────────
  trading: [
    {
      selector: '.trading-header',
      title: '💰 Tổng Quan Số Dư & Tài Sản',
      description: 'Hiển thị Tổng tài sản và Số dư khả dụng sẵn sàng để đặt lệnh. Tiền đang nằm trong các lệnh chờ khớp sẽ tạm thời bị khóa an toàn.',
      position: 'bottom',
    },
    {
      selector: '.trade-tabs',
      title: '🔀 Chọn Loại Giao Dịch (MUA / BÁN)',
      description: '• MUA: Tìm kiếm cổ phiếu trên thị trường để đặt mua\n• BÁN: Chọn các cổ phiếu đang sở hữu trong danh mục để bán.',
      position: 'bottom',
    },
    {
      selector: '.trading-form-card',
      title: '📝 Form Nhập Lệnh Chuẩn',
      description: '1. Chọn mã cổ phiếu\n2. Chọn loại lệnh (Lệnh Giới Hạn LO hoặc Thị Trường MP)\n3. Nhập mức giá và khối lượng (bội số 100 theo chuẩn sàn VN)\n4. Kiểm tra tổng giá trị giao dịch ước tính.',
      position: 'bottom',
    },
    {
      selector: '.otp-section',
      title: '🔐 Xác Thực OTP An Toàn (Khi Bán)',
      description: 'Khi bán cổ phiếu, hệ thống gửi mã OTP 6 số qua email để xác thực danh tính chính chủ và bảo vệ tài sản của bạn.',
      position: 'bottom',
    },
    {
      selector: '.trading-sidebar',
      title: '📋 Lệnh Gần Đây & Danh Mục Nhanh',
      description: 'Theo dõi nhanh 5 lệnh mới nhất và số lượng cổ phiếu đang giữ ngay cạnh form đặt lệnh mà không cần chuyển trang.',
      position: 'bottom',
    },
  ],

  // ─── 04. Lệnh Điều Kiện Nâng Cao (ConditionalOrderPage) 
  conditionalOrder: [
    {
      selector: '.cond-header',
      title: '⚡ Lệnh Điều Kiện Tự Động',
      description: 'Lệnh điều kiện được lên lịch sẵn và hệ thống sẽ tự động kích hoạt đẩy vào sàn khi thị giá thỏa mãn điều kiện bạn đặt trước.',
      position: 'bottom',
    },
    {
      selector: '.cond-form-card',
      title: '📋 7 Chiến Lược Lệnh Tự Động',
      description: 'Hỗ trợ các loại lệnh chuyên nghiệp:\n• Stop Order: Kích hoạt khi chạm giá kích hoạt\n• Trailing Stop: Tự động trượt điểm dừng theo xu hướng giá tăng\n• OCO (One-Cancels-the-Other): Đặt cùng lúc Chốt lời & Cắt lỗ, khi một bên khớp thì bên kia tự hủy\n• GTD: Lệnh giữ hiệu lực nhiều ngày.',
      position: 'bottom',
    },
    {
      selector: '.cond-select-wrapper',
      title: '🎯 Chọn Loại Lệnh Điều Kiện',
      description: 'Click để chọn loại lệnh. Form bên dưới sẽ tự động thay đổi các trường dữ liệu tương ứng (Giá kích hoạt, Biên trượt delta, Ngày hết hạn).',
      position: 'bottom',
    },
    {
      selector: '.otp-section',
      title: '🔐 Xác Thực OTP Bắt Buộc',
      description: 'Mọi lệnh điều kiện đều yêu cầu xác thực OTP qua email để kích hoạt lịch trình bảo mật.',
      position: 'bottom',
    },
  ],

  // ─── 05. Danh Mục Đầu Tư (PortfolioPage) ───────────────
  portfolio: [
    {
      selector: '.pf-nav-section',
      title: '📂 Quản Lý Nhiều Danh Mục Chiến Lược',
      description: 'Hệ thống cho phép bạn tạo nhiều danh mục con (ví dụ: Đầu tư dài hạn, Lướt sóng T+...) bằng nút "+ Tạo danh mục" và bấm ✏️ để chỉnh sửa tên, mô tả hay thay đổi danh sách mã.',
      position: 'bottom',
    },
    {
      selector: '.pf-editorial-summary-grid',
      title: '💰 Thống Kê Tài Sản & Hiệu Suất Sinh Lời',
      description: 'Theo dõi 4 thẻ chỉ số: Tổng tài sản (NAV), Vốn đầu tư, Tiền mặt khả dụng, và Tổng Lãi/Lỗ tạm tính. Khi chuyển tab danh mục, số liệu sẽ tự động tính toán lại tương ứng.',
      position: 'bottom',
    },
    {
      selector: '.pf-allocation-surface',
      title: '🍩 Biểu Đồ Phân Bổ Tỷ Trọng Vốn',
      description: 'Biểu đồ Donut trực quan hóa cơ cấu phân bổ giữa các mã cổ phiếu đang sở hữu trong danh mục đang chọn.',
      position: 'top',
    },
    {
      selector: '.pf-table-surface',
      title: '📊 Bảng Chi Tiết Cổ Phiếu Đang Nắm Giữ',
      description: 'Chi tiết từng vị thế: Khối lượng, Giá TB Mua, Giá Thị Trường, Tổng Thị Giá và Lãi/Lỗ. Bạn có thể bấm "Bán" để chốt lời hoặc cắt lỗ ngay lập tức.',
      position: 'top',
    },
  ],

  // ─── 06. Sổ Lệnh Chi Tiết (OrderBookPage) ──────────────
  orderBook: [
    {
      selector: '.ob-header',
      title: '📊 Sổ Lệnh Real-time (Order Book)',
      description: 'Hiển thị độ sâu thị trường (Market Depth) với toàn bộ các bước giá Mua và Bán đang chờ khớp của một mã cổ phiếu.',
      position: 'bottom',
    },
    {
      selector: '.ob-search-section',
      title: '🔍 Chọn Mã Cổ Phiếu',
      description: 'Nhập mã ticker (ví dụ: FPT, VNM, HPG) để xem ngay cấu trúc lệnh chờ của mã đó.',
      position: 'bottom',
    },
    {
      selector: '.ob-bid-side',
      title: '🟢 Cột Bên MUA (BID)',
      description: 'Danh sách các lệnh chờ mua xếp theo thứ tự ưu tiên: Giá mua cao nhất ở trên cùng.',
      position: 'bottom',
    },
    {
      selector: '.ob-ask-side',
      title: '🔴 Cột Bên BÁN (ASK)',
      description: 'Danh sách các lệnh chờ bán xếp theo thứ tự ưu tiên: Giá bán thấp nhất ở trên cùng. Chênh lệch giữa Giá Mua tốt nhất và Giá Bán tốt nhất gọi là Spread.',
      position: 'bottom',
    },
    {
      selector: '.ob-summary',
      title: '📈 Thống Kê Cung - Cầu',
      description: 'So sánh tổng khối lượng đặt mua vs tổng khối lượng đặt bán để đánh giá xu hướng áp lực giá trong phiên.',
      position: 'bottom',
    },
  ],

  // ─── 07. Quản Lý Sổ Lệnh (OrderHistoryPage) ────────────
  orders: [
    {
      selector: '.order-top-header',
      title: '✅ Quản Lý Lệnh Đặt',
      description: 'Nơi tập hợp toàn bộ các lệnh mua/bán bạn đã đặt trên sàn kèm trạng thái thực tế.',
      position: 'bottom',
    },
    {
      selector: '.order-controls-bar',
      title: '🔽 Bộ Lọc Trạng Thái Lệnh',
      description: 'Lọc nhanh lệnh theo các trạng thái: Tất cả, Chờ khớp (PENDING), Khớp một phần, Đã khớp (FILLED), Đã hủy hoặc Bị từ chối.',
      position: 'bottom',
    },
    {
      selector: '.order-table-card',
      title: '📋 Thao Tác & Quản Lý Lệnh',
      description: 'Đối với các lệnh đang Chờ khớp (PENDING), bạn có thể bấm nút Sửa để thay đổi giá/khối lượng, hoặc bấm Hủy lệnh để hoàn tiền/cổ phiếu về ví ngay lập tức.',
      position: 'top',
    },
  ],

  // ─── 08. Lịch Sử Khớp Lệnh (TransactionHistoryPage) ───
  transactions: [
    {
      selector: '.tx-top-header',
      title: '📜 Sao Kê Khớp Lệnh Giao Dịch',
      description: 'Ghi lại các giao dịch đã thực sự KHỚP lệnh thành công trên sàn chứng khoán StockLab.',
      position: 'bottom',
    },
    {
      selector: '.tx-controls-bar',
      title: '🔽 Phân Loại Mua / Bán',
      description: 'Dễ dàng lọc riêng các lệnh Mua (tiền ra mua cổ phiếu) hoặc Bán (bán cổ phiếu thu tiền về ví).',
      position: 'bottom',
    },
    {
      selector: '.tx-table-container',
      title: '📊 Bảng Nhật Ký Giao Dịch',
      description: 'Mỗi dòng hiển thị chi tiết mã chứng khoán, khối lượng khớp, giá khớp thực tế, tổng số tiền và thời gian khớp lệnh chính xác đến từng giây.',
      position: 'top',
    },
  ],

  // ─── 09. Ví Tiền & Nguồn Vốn (WalletPage) ──────────────
  wallet: [
    {
      selector: '.wallet-account-column',
      title: '💰 Tài Khoản Tiền Mặt & Số Dư',
      description: 'Quản lý số dư tiền mặt: Số dư khả dụng (sẵn sàng mua hoặc rút) và Số tiền tạm giữ (đang đặt mua chờ khớp).',
      position: 'bottom',
    },
    {
      selector: '.wallet-tab-strip',
      title: '📑 Các Nghiệp Vụ Ví Tiền',
      description: 'Chuyển đổi giữa 3 tab nghiệp vụ:\n01: Nạp tiền trực tuyến qua VNPay QR\n02: Rút tiền về tài khoản ngân hàng\n03: Xem lịch sử nạp/rút tiền.',
      position: 'bottom',
    },
    {
      selector: '.wallet-actions-column',
      title: '🏦 Khu Vực Thao Tác Giao Dịch',
      description: 'Nhập số tiền nạp để thanh toán tức thì qua cổng VNPay Sandbox, hoặc gửi yêu cầu rút tiền với mã xác thực OTP bảo mật.',
      position: 'bottom',
    },
  ],

  // ─── 10. Danh Sách Theo Dõi (WatchlistPage) ───────────
  watchlist: [
    {
      selector: '.wl-header',
      title: '⭐ Danh Sách Cổ Phiếu Quan Tâm',
      description: 'Tập hợp các mã cổ phiếu bạn đã đánh dấu theo dõi để tiện quan sát biến động thị giá mỗi ngày.',
      position: 'bottom',
    },
    {
      selector: '.wl-grid',
      title: '🗂️ Thẻ Cổ Phiếu Theo Dõi',
      description: 'Mỗi thẻ hiển thị thị giá, biến động phần trăm và sàn niêm yết. Bạn có thể bấm vào thẻ để mở biểu đồ chi tiết hoặc bấm "Giao dịch" để đặt lệnh nhanh.',
      position: 'bottom',
    },
  ],

  // ─── 11. Giám Sát Trading Bot (BotActivityPage) ────────
  botActivity: [
    {
      selector: '.bot-header',
      title: '🤖 Phân Hệ Tạo Lập Thị Trường (Bot Liquidity)',
      description: 'Hệ thống bot tự động đặt lệnh mua và bán đối ứng theo thuật toán để duy trì thanh khoản cho sàn mô phỏng.',
      position: 'bottom',
    },
    {
      selector: '.bot-stats-grid',
      title: '📊 Chỉ Số Hoạt Động Của Bot',
      description: 'Theo dõi trạng thái Bật/Tắt của bot, tổng số lệnh bot đã đẩy vào sổ lệnh, tần suất chu kỳ quét và tài khoản điều phối.',
      position: 'bottom',
    },
    {
      selector: '.bot-activity-card',
      title: '📋 Nhật Ký Lệnh Bot Thời Gian Thực',
      description: 'Bảng theo dõi trực tiếp các lệnh mua/bán do bot tự động kích hoạt trên các mã cổ phiếu trong phiên.',
      position: 'top',
    },
  ],

  // ─── 11b. Kịch Bản Thao Túng Thị Trường (Manipulation) ───
  manipulation: [
    {
      selector: '.bot-header',
      title: '⚡ Kịch Bản Thao Túng & Định Hướng Xu Hướng Giá',
      description: 'Hệ thống cho phép Quản trị viên can thiệp vào diễn biến giá với 6 kịch bản tạo lập chuyên nghiệp: Bơm xả, Bẫy giảm giá, Bẫy tăng giá, Đè gom đi ngang, Khớp chéo thanh khoản và Khóa trần/sàn.',
      position: 'bottom',
    },
    {
      selector: '.bot-killswitch-banner',
      title: '🚨 Cơ Chế Dừng Khẩn Cấp (Kill-Switch)',
      description: 'Một chạm lập tức hủy bỏ toàn bộ chiến dịch đang chạy và thu hồi mọi lệnh mua/bán của bot đang treo trên toàn sàn giao dịch.',
      position: 'bottom',
    },
    {
      selector: '.manipulation-config-card',
      title: '🎯 Bộ Chọn Cổ Phiếu & Cấu Hình Tham Số',
      description: 'Chọn nhanh theo nhóm ngành (Thép, Ngân hàng, BĐS, VN30) hoặc chọn lẻ các mã cổ phiếu; điều chỉnh thời lượng, cường độ khớp và bước giá.',
      position: 'top',
    },
    {
      selector: '.scenarios-grid',
      title: '🃏 6 Thẻ Kịch Bản Thao Túng Thị Trường',
      description: 'Xem chi tiết các pha diễn biến giá của từng kịch bản và bấm "Kích Hoạt" để hệ thống bot tự động triển khai tức thì.',
      position: 'top',
    },
  ],

  // ─── 12. Tổng Quan Thị Trường (DashboardPage) ─────────
  dashboard: [
    {
      selector: '.wealth-platinum-card',
      title: '💼 Tài Khoản & Tổng Quan Nguồn Vốn',
      description: 'Xem nhanh tổng tài sản ròng, số dư khả dụng và trạng thái kết nối sàn khớp lệnh tự động.',
      position: 'bottom',
    },
    {
      selector: '.ai-editorial-card',
      title: '🤖 Trợ Lý Tư Vấn AI Gemini',
      description: 'Trợ lý thông minh hỗ trợ phân tích kỹ thuật, giải thích chỉ số tài chính và gợi ý chiến lược đầu tư theo thời gian thực.',
      position: 'bottom',
    },
    {
      selector: '.bento-movers',
      title: '📈 Cổ Phiếu Thanh Khoản Hàng Đầu',
      description: 'Top các mã cổ phiếu có khối lượng giao dịch và giá trị trao tay lớn nhất trong phiên hiện tại.',
      position: 'bottom',
    },
    {
      selector: '.bento-modules',
      title: '⚡ Trung Tâm Tiện Ích Giao Dịch',
      description: 'Lối tắt truy cập nhanh các nghiệp vụ: Lệnh điều kiện, Sổ lệnh chi tiết, Nạp rút tiền và Danh mục đầu tư.',
      position: 'top',
    },
  ],

  // ─── 13. Tin Tức Tài Chính 24/7 (NewsPage) ─────────────
  news: [
    {
      selector: '.news-top-header',
      title: '📰 Dòng Chảy Tin Tức & Thời Sự Tài Chính',
      description: 'Tổng hợp 100% tin tức tài chính, ngân hàng và chứng khoán cập nhật tự động từ CafeF, VnEconomy, Tuổi Trẻ.',
      position: 'bottom',
    },
    {
      selector: '.news-control-bar',
      title: '🔍 Lọc Theo Nguồn Báo & Tìm Kiếm',
      description: 'Lọc bài viết theo từng nguồn báo ưa thích hoặc tìm kiếm theo từ khóa liên quan đến doanh nghiệp và ngành nghề.',
      position: 'bottom',
    },
    {
      selector: '.news-featured-card',
      title: '🔥 Tiêu Điểm Tin Tức Nổi Bật',
      description: 'Bài viết quan trọng và nóng nhất về thị trường tài chính trong phiên.',
      position: 'bottom',
    },
    {
      selector: '.news-grid-section',
      title: '📑 Danh Sách Bản Tin Chuyên Sâu',
      description: 'Các bài viết phân tích, báo cáo tài chính và sự kiện thị trường. Click vào bài viết để đọc bài gốc trên báo.',
      position: 'top',
    },
  ],

  // ─── 14. Xuất Báo Cáo Tài Chính (ReportPage) ───────────
  report: [
    {
      selector: '.report-container',
      title: '📊 Trung Tâm Xuất Báo Cáo',
      description: 'Kết xuất dữ liệu giao dịch dưới dạng file Excel để lưu trữ, kê khai hoặc phân tích ngoại tuyến.',
      position: 'bottom',
    },
    {
      selector: '.report-card',
      title: '📥 Xuất File Lịch Sử Giao Dịch',
      description: 'Tải xuống toàn bộ nhật ký mua bán cổ phiếu thành công kèm giá và khối lượng khớp lệnh.',
      position: 'bottom',
    },
  ],
};

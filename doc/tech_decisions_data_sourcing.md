# 📡 StockLab — Technical Decisions: Data Sourcing & Integration

Tài liệu này ghi lại các quyết định kỹ thuật quan trọng liên quan đến việc tích hợp dữ liệu từ các nguồn bên ngoài vào hệ thống StockLab, bao gồm dữ liệu thị trường chứng khoán, tin tức tài chính và phân tích AI.

## 1. Dữ Liệu Cổ Phiếu Thực Tế (Market Data)

**Vấn đề:** Không có API công khai, miễn phí và ổn định (no auth) từ CafeF hay TCBS hỗ trợ truy vấn trực tiếp từ frontend hoặc backend Java một cách dễ dàng.

**Các API đã thử nghiệm (bị block hoặc thay đổi endpoint):**
*   `apipubaws.tcbs.com.vn` (404 Not Found)
*   `finfo-api.vndirect.com.vn` (Timeout/Connection Refused)
*   `api-finfo.vn` (No such host)
*   `iboard-query.ssi.com.vn` (Request not found / CORS)
*   `finance.vietstock.vn` (Trả về HTML thay vì JSON)
*   `wifeed.vn` (Yêu cầu API key)

**Giải pháp được chọn: One-time Import via Python Wrapper**
Chúng ta sẽ KHÔNG phụ thuộc vào runtime API (call liên tục mỗi khi user truy cập) để tránh bị rate limit hoặc block IP. Thay vào đó:
1.  **Dùng Python script:** Sử dụng thư viện cộng đồng `vnstock` (đang maintain tốt nhất hiện nay).
2.  **Pull 1 lần duy nhất:** Lấy dữ liệu OHLCV (Open, High, Low, Close, Volume) trong 2 năm gần nhất của 30 mã blue-chip (VN30).
3.  **Import vào MySQL:** Ghi đè vào bảng `stock_price_history` của StockLab.
4.  **Backend độc lập:** Spring Boot backend sẽ chỉ query từ MySQL nội bộ, không còn phụ thuộc vào service bên ngoài.

## 2. Tin Tức Tài Chính (Financial News)

**Vấn đề:** CafeF không cung cấp API hoặc RSS feed chính thức cho danh mục tin tức chứng khoán/tài chính.

**Giải pháp được chọn: Backend Proxy Scraper & RSS**
Để cung cấp luồng tin tức real-time mà không làm chậm client:
1.  **Spring Boot Backend làm Proxy:** Viết `NewsService` trên backend.
2.  **Web Scraping (CafeF):** Dùng thư viện `Jsoup` (Java) parse HTML từ trang chủ hoặc chuyên mục chứng khoán của CafeF để lấy danh sách title, link, thumbnail.
3.  **RSS Parsing (VnEconomy/Khác):** Fetch và parse XML từ các trang có hỗ trợ RSS công khai (ví dụ: `vneconomy.vn/chung-khoan.rss`).
4.  **Redis Caching:** Lưu cache kết quả tổng hợp vào Redis với TTL (Time-To-Live) khoảng 15-30 phút.
5.  **Frontend API:** Client gọi `GET /api/news` nội bộ cực kỳ nhanh từ cache.

## 3. AI Bot Trợ Lý Đầu Tư (AI Assistant)

**Vấn đề:** Cần một AI mạnh mẽ để hiểu biểu đồ, dự đoán xu hướng và phân tích danh mục, nhưng chi phí phải thấp.

**Giải pháp được chọn: Google Gemini API (Free Tier)**
1.  **Model:** `gemini-2.0-flash` (nhanh, context window lớn).
2.  **Integration:** Gọi trực tiếp REST API từ Spring Boot backend.
3.  **Context Injection:** Bot chỉ thông minh nếu có dữ liệu. Backend sẽ tự động lấy dữ liệu nội bộ (giá hiện tại, OHLCV 30 ngày qua, MA/RSI indicators, P&L của user) và "nhét" vào System Prompt trước khi gửi cho Gemini.
4.  **Rate Limiting:** Sử dụng Redis để giới hạn số lượng request per user per day (ví dụ: 20 câu hỏi/ngày) để bảo vệ Free Tier quota của Google (15 RPM, 1M TPM).

## 4. Tóm tắt luồng Data (Dependency Graph)

Để các tính năng hoạt động trơn tru, thứ tự triển khai rất quan trọng:

```
[Python Script (vnstock)]  ──(import)──>  [MySQL Database]
                                                 │
                                                 ▼
[Jsoup Scraper / RSS] ──(fetch)──> [Redis Cache] ┼──> [Spring Boot API] ──> [React Frontend]
                                                 │                             ▲
                                                 ▼                             │
[Google Gemini API] <──(prompt + context)── [AIAssistantService] ──────────────┘
```

*   **Dữ liệu thực tế** phải có trước để AI phân tích đúng.
*   **Tin tức** phải có trước để có thể hỏi AI về sự kiện thị trường.
*   **OrderBook và Indicators** (tính toán nội bộ) cũng đóng vai trò làm input (context) cho AI Bot.

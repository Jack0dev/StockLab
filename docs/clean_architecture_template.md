my-app/
├── src/
│   ├── main.js                 # Điểm khởi chạy ứng dụng (Entry point)
│   │
│   ├── presentation/           # TẦNG GIAO DIỆN / TIẾP NHẬN REQUEST
│   │   ├── controllers/        # Điều hướng request, validate input đầu vào
│   │   │   ├── user.controller.js
│   │   │   └── order.controller.js
│   │   └── dtos/               # Data Transfer Objects (Định nghĩa khuôn mẫu dữ liệu gửi/nhận)
│   │       ├── user-register.dto.js
│   │       └── user-response.dto.js
│   │
│   ├── service/                # TẦNG NGHIỆP VỤ (BUSINESS LOGIC LAYER)
│   │   ├── user.service.js     # Xử lý logic đăng ký, gửi email, kiểm tra trùng lặp
│   │   └── order.service.js    # Tính tiền, áp mã giảm giá, tạo đơn hàng
│   │
│   ├── domain/                 # TẦNG THỰC THỂ CỐT LÕI (DOMAIN LAYER)
│   │   ├── entities/           # Định nghĩa cấu trúc đối tượng trong hệ thống
│   │   │   ├── user.entity.js
│   │   │   └── order.entity.js
│   │   └── exceptions/         # Các lỗi nghiệp vụ tự định nghĩa (Ví dụ: InsufficientFundsException)
│   │       └── business.exception.js
│   │
│   └── infrastructure/         # TẦNG DỮ LIỆU & HẠ TẦNG (DATA ACCESS / PERSISTENCE LAYER)
│       ├── repositories/       # Thực hiện các câu lệnh truy vấn DB (SQL, NoSQL)
│       │   ├── user.repository.js
│       │   └── order.repository.js
│       ├── database/           # Cấu hình kết nối Database, Migrations
│       │   └── db-connection.js
│       └── config/             # Cấu hình biến môi trường, Mail server, Third-party API
│           └── mailer.js
│
├── tests/                      # Thư mục chứa mã nguồn kiểm thử (Unit test, Integration test)
├── package.json
└── README.md
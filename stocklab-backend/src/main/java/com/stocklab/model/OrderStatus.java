package com.stocklab.model;

/**
 * Trạng thái lệnh — lifecycle chuẩn:
 *
 * MARKET/LIMIT:        ACTIVE → PARTIALLY_FILLED → FILLED / CANCELLED
 * Lệnh điều kiện:     PENDING_TRIGGER → ACTIVE → PARTIALLY_FILLED → FILLED / CANCELLED / EXPIRED
 */
public enum OrderStatus {
    PENDING_TRIGGER,   // Lệnh điều kiện đang chờ kích hoạt (STOP/TP/TRAILING/OCO)
    ACTIVE,            // Đã vào sổ lệnh, sẵn sàng khớp
    PARTIALLY_FILLED,  // Khớp 1 phần
    FILLED,            // Khớp hoàn toàn
    CANCELLED,         // Đã hủy
    EXPIRED            // Hết hạn (GTD timeout)
}

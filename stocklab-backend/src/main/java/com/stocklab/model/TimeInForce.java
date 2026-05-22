package com.stocklab.model;

/**
 * Thời gian hiệu lực của lệnh
 * Chỉ áp dụng khi order ở trạng thái ACTIVE (sau trigger)
 */
public enum TimeInForce {
    GTC,  // Good Till Cancel — tồn tại cho đến khi khớp hoặc user hủy
    IOC,  // Immediate Or Cancel — khớp ngay phần có thể, hủy phần còn lại
    FOK,  // Fill Or Kill — phải khớp toàn bộ hoặc hủy hết
    GTD   // Good Till Date — tồn tại đến ngày hết hạn
}

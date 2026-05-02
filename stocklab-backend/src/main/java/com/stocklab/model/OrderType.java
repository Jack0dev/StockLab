package com.stocklab.model;

/**
 * Loại lệnh giao dịch — hợp nhất cả lệnh thường và lệnh điều kiện
 */
public enum OrderType {
    MARKET,              // Lệnh thị trường — khớp ngay theo giá tốt nhất
    LIMIT,               // Lệnh giới hạn — chỉ khớp khi giá đạt mức mong muốn
    STOP_MARKET,         // Khi chạm stopPrice → behave như MARKET
    STOP_LIMIT,          // Khi chạm stopPrice → behave như LIMIT
    TAKE_PROFIT,         // Khi đạt target price → behave như MARKET
    TAKE_PROFIT_LIMIT,   // Khi đạt target price → behave như LIMIT
    TRAILING_STOP,       // Stop di chuyển theo giá → MARKET khi trigger
    TRAILING_STOP_LIMIT, // Stop di chuyển theo giá → LIMIT khi trigger
    OCO;                 // One Cancels Other — 2 lệnh liên kết

    /**
     * Lệnh có điều kiện kích hoạt (cần TriggerEngine xử lý)
     */
    public boolean isConditional() {
        return this != MARKET && this != LIMIT;
    }

    /**
     * Sau khi trigger, lệnh hoạt động như MARKET (khớp ngay)
     */
    public boolean isMarketLike() {
        return this == MARKET || this == STOP_MARKET
                || this == TAKE_PROFIT || this == TRAILING_STOP;
    }

    /**
     * Sau khi trigger, lệnh hoạt động như LIMIT (chờ giá)
     */
    public boolean isLimitLike() {
        return this == LIMIT || this == STOP_LIMIT
                || this == TAKE_PROFIT_LIMIT || this == TRAILING_STOP_LIMIT
                || this == OCO;
    }

    /**
     * Yêu cầu stopPrice khi đặt lệnh
     */
    public boolean requiresStopPrice() {
        return this == STOP_MARKET || this == STOP_LIMIT
                || this == TAKE_PROFIT || this == TAKE_PROFIT_LIMIT;
    }

    /**
     * Yêu cầu trailingDelta khi đặt lệnh
     */
    public boolean requiresTrailingDelta() {
        return this == TRAILING_STOP || this == TRAILING_STOP_LIMIT;
    }
}

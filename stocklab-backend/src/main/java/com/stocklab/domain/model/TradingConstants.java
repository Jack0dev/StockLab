package com.stocklab.domain.model;

import java.math.BigDecimal;

/**
 * Domain Constants: Core financial and exchange trading rules.
 * Pure constants and exchange rule resolvers independent of frameworks.
 */
public final class TradingConstants {

    private TradingConstants() {
        // Prevent instantiation
    }

    /** Tỷ lệ phí giao dịch chuẩn mặc định: 0.15% (0.0015) */
    public static final BigDecimal DEFAULT_FEE_RATE = new BigDecimal("0.0015");

    /** Bước nhảy lô giao dịch chuẩn (Khối lượng tối thiểu và bội số): 100 CP */
    public static final int LOT_STEP = 100;

    /** Biên độ dao động sàn HOSE: ±7% */
    public static final double HOSE_AMPLITUDE = 0.07;

    /** Biên độ dao động sàn HNX: ±10% */
    public static final double HNX_AMPLITUDE = 0.10;

    /** Biên độ dao động sàn UPCOM: ±15% */
    public static final double UPCOM_AMPLITUDE = 0.15;

    /** Bảng mã màu palette chuẩn cho biểu đồ phân bổ danh mục */
    public static final String[] PORTFOLIO_CHART_PALETTE = {
            "#2962ff", "#00c853", "#ff6d00", "#aa00ff", "#d50000",
            "#00bfa5", "#6200ea", "#c51162", "#0091ea", "#64dd17"
    };

    /**
     * Xác định biên độ dao động giá theo sàn giao dịch (HOSE: 7%, HNX: 10%, UPCOM: 15%)
     */
    public static double getExchangeAmplitude(String exchange) {
        if (exchange == null) {
            return HOSE_AMPLITUDE;
        }
        String ex = exchange.trim().toUpperCase();
        if ("HNX".equals(ex)) {
            return HNX_AMPLITUDE;
        }
        if ("UPCOM".equals(ex)) {
            return UPCOM_AMPLITUDE;
        }
        return HOSE_AMPLITUDE;
    }

    /**
     * Tính toán giá trần (Ceiling Price) theo sàn giao dịch
     */
    public static BigDecimal calculateCeilingPrice(BigDecimal referencePrice, String exchange) {
        if (referencePrice == null) {
            return null;
        }
        double amp = getExchangeAmplitude(exchange);
        BigDecimal delta = referencePrice.multiply(BigDecimal.valueOf(amp));
        return referencePrice.add(delta).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /**
     * Tính toán giá sàn (Floor Price) theo sàn giao dịch
     */
    public static BigDecimal calculateFloorPrice(BigDecimal referencePrice, String exchange) {
        if (referencePrice == null) {
            return null;
        }
        double amp = getExchangeAmplitude(exchange);
        BigDecimal delta = referencePrice.multiply(BigDecimal.valueOf(amp));
        BigDecimal floor = referencePrice.subtract(delta).setScale(2, java.math.RoundingMode.HALF_UP);
        return floor.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : floor;
    }
}

package com.stocklab.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrderRequest {

    @NotBlank(message = "Mã cổ phiếu không được để trống")
    private String ticker;

    @NotNull(message = "Loại lệnh (BUY/SELL) không được để trống")
    private String side; // BUY hoặc SELL

    @NotNull(message = "Kiểu lệnh không được để trống")
    private String orderType; // MARKET, LIMIT, STOP_MARKET, STOP_LIMIT, ...

    @NotNull(message = "Số lượng không được để trống")
    @Min(value = 1, message = "Số lượng phải lớn hơn 0")
    private Integer quantity;

    // Giá đặt — bắt buộc khi LIMIT-like, bỏ qua khi MARKET-like
    private BigDecimal price;

    // === Conditional Order Fields ===

    /** Giá kích hoạt cho STOP_*, TAKE_PROFIT_* */
    private BigDecimal stopPrice;

    /** Thời gian hiệu lực: GTC, IOC, FOK, GTD */
    private String timeInForce;

    /** Khoảng trailing (%) cho TRAILING_* */
    private BigDecimal trailingDelta;

    /** Giá bắt đầu track trailing (optional) */
    private BigDecimal activationPrice;

    // === OCO Fields ===

    /** Giá stop cho OCO (lệnh thứ 2) */
    private BigDecimal ocoStopPrice;

    /** Giá limit cho OCO (lệnh thứ 2) */
    private BigDecimal ocoLimitPrice;

    // === GTD ===

    /** Ngày hết hạn cho TimeInForce = GTD (ISO format) */
    private String expiryDate;

    // === OTP ===

    /** Mã OTP xác thực đặt lệnh */
    private String otpCode;
}

package com.stocklab.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PlatformTokenResponse {
    private String ticker;             // "SLP"
    private String name;               // "StockLab Platform Token"
    private BigDecimal currentPrice;   // Giá hiện tại
    private BigDecimal basePrice;      // Giá ban đầu
    private BigDecimal change;         // Thay đổi giá (VND)
    private Double changePercent;      // Thay đổi (%)
    private Long totalSupply;          // Tổng supply
    private BigDecimal marketCap;      // Vốn hoá = currentPrice * totalSupply

    // Platform metrics
    private BigDecimal totalFeesCollected;  // Tổng phí thu
    private BigDecimal dailyFees;           // Phí hôm nay
    private Long totalTradesCount;          // Tổng giao dịch
    private BigDecimal totalTradingVolume;  // Tổng KLGD
    private Double feeRate;                 // Tỉ lệ phí (%)
}

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
public class StockResponse {
    private Long id;
    private String ticker;
    private String companyName;
    private String exchange;
    private BigDecimal currentPrice;
    private BigDecimal openPrice;
    private BigDecimal highPrice;
    private BigDecimal lowPrice;
    private BigDecimal referencePrice;
    private Long volume;
    private BigDecimal change;
    private Double changePercent;
    private boolean isActive;
}

package com.stocklab.presentation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PortfolioSummaryResponse {

    private BigDecimal totalAssets;
    private BigDecimal totalStockValue;
    private BigDecimal totalInvested;
    private BigDecimal cashBalance;
    private BigDecimal totalPnL;
    private Double totalPnLPercent;
    private List<AllocationItem> allocations;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AllocationItem {
        private String ticker;
        private String companyName;
        private BigDecimal value;
        private Double percentage;
        private String color;
    }
}

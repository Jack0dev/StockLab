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
public class CustomPortfolioSummaryResponse {

    private Long id;
    private String name;
    private String description;
    private BigDecimal totalStockValue;
    private BigDecimal totalInvested;
    private BigDecimal totalPnL;
    private Double totalPnLPercent;
    private List<PortfolioResponse> holdings;
    private List<PortfolioSummaryResponse.AllocationItem> allocations;
}

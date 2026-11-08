package com.stocklab.service.order;

import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.TradingConstants;
import com.stocklab.presentation.dto.PortfolioSummaryResponse;
import lombok.Builder;
import lombok.Data;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Service/Domain Component: Calculates portfolio metrics and asset allocations.
 * 100% null-safe and reusable across Default Portfolio & Custom Strategy Portfolios.
 */
@Component
public class PortfolioMetricsCalculator {

    @Data
    @Builder
    public static class CalculationResult {
        private BigDecimal totalAssets;
        private BigDecimal totalStockValue;
        private BigDecimal totalInvested;
        private BigDecimal cashBalance;
        private BigDecimal totalPnL;
        private Double totalPnLPercent;
        private List<PortfolioSummaryResponse.AllocationItem> allocations;
    }

    public CalculationResult calculate(List<Portfolio> holdings, BigDecimal cashBalance) {
        BigDecimal effectiveCash = cashBalance != null ? cashBalance : BigDecimal.ZERO;

        if (holdings == null || holdings.isEmpty()) {
            return CalculationResult.builder()
                    .totalAssets(effectiveCash)
                    .totalStockValue(BigDecimal.ZERO)
                    .totalInvested(BigDecimal.ZERO)
                    .cashBalance(effectiveCash)
                    .totalPnL(BigDecimal.ZERO)
                    .totalPnLPercent(0.0)
                    .allocations(Collections.emptyList())
                    .build();
        }

        String[] palette = TradingConstants.PORTFOLIO_CHART_PALETTE;
        BigDecimal totalStockValue = BigDecimal.ZERO;
        BigDecimal totalInvested = BigDecimal.ZERO;
        List<PortfolioSummaryResponse.AllocationItem> allocations = new ArrayList<>();

        for (int i = 0; i < holdings.size(); i++) {
            Portfolio p = holdings.get(i);
            if (p == null) continue;

            Stock stock = p.getStock();
            if (stock == null) continue;

            BigDecimal currentPrice = stock.getCurrentPrice() != null ? stock.getCurrentPrice()
                    : (stock.getReferencePrice() != null ? stock.getReferencePrice() : BigDecimal.ZERO);
            int qty = p.getQuantity() != null ? p.getQuantity() : 0;
            BigDecimal stockValue = currentPrice.multiply(BigDecimal.valueOf(qty));
            totalStockValue = totalStockValue.add(stockValue);

            BigDecimal avgBuyPrice = p.getAvgBuyPrice() != null ? p.getAvgBuyPrice() : BigDecimal.ZERO;
            BigDecimal cost = avgBuyPrice.multiply(BigDecimal.valueOf(qty));
            totalInvested = totalInvested.add(cost);

            allocations.add(PortfolioSummaryResponse.AllocationItem.builder()
                    .ticker(stock.getTicker())
                    .companyName(stock.getCompanyName())
                    .value(stockValue)
                    .color(palette[i % palette.length])
                    .build());
        }

        // Tính toán tỷ trọng phần trăm (%) cho từng cổ phiếu
        for (PortfolioSummaryResponse.AllocationItem item : allocations) {
            if (totalStockValue.compareTo(BigDecimal.ZERO) > 0 && item.getValue() != null) {
                double pct = item.getValue()
                        .divide(totalStockValue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .doubleValue();
                item.setPercentage(pct);
            } else {
                item.setPercentage(0.0);
            }
        }

        // Tính lãi lỗ tổng hợp
        BigDecimal totalPnL = totalStockValue.subtract(totalInvested);
        double totalPnLPercent = totalInvested.compareTo(BigDecimal.ZERO) > 0
                ? totalPnL.divide(totalInvested, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .doubleValue()
                : 0.0;

        BigDecimal totalAssets = totalStockValue.add(effectiveCash);

        return CalculationResult.builder()
                .totalAssets(totalAssets)
                .totalStockValue(totalStockValue)
                .totalInvested(totalInvested)
                .cashBalance(effectiveCash)
                .totalPnL(totalPnL)
                .totalPnLPercent(totalPnLPercent)
                .allocations(allocations)
                .build();
    }
}

package com.stocklab.service.order;

import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.TradingConstants;
import com.stocklab.presentation.dto.PortfolioSummaryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("PortfolioMetricsCalculator Unit Tests")
class PortfolioMetricsCalculatorTest {

    private PortfolioMetricsCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new PortfolioMetricsCalculator();
    }

    @Test
    @DisplayName("calculate: null hoặc danh sách rỗng phải trả về kết quả an toàn mặc định")
    void testCalculate_emptyOrNullHoldings_shouldReturnSafeDefaults() {
        // Given
        BigDecimal cash = new BigDecimal("50000000.00");

        // When (null holdings)
        PortfolioMetricsCalculator.CalculationResult nullResult = calculator.calculate(null, cash);

        // Then
        assertNotNull(nullResult);
        assertEquals(new BigDecimal("50000000.00"), nullResult.getTotalAssets());
        assertEquals(BigDecimal.ZERO, nullResult.getTotalStockValue());
        assertEquals(BigDecimal.ZERO, nullResult.getTotalInvested());
        assertEquals(BigDecimal.ZERO, nullResult.getTotalPnL());
        assertEquals(0.0, nullResult.getTotalPnLPercent());
        assertTrue(nullResult.getAllocations().isEmpty());

        // When (empty holdings list)
        PortfolioMetricsCalculator.CalculationResult emptyResult = calculator.calculate(List.of(), cash);

        // Then
        assertNotNull(emptyResult);
        assertEquals(new BigDecimal("50000000.00"), emptyResult.getTotalAssets());
        assertEquals(0.0, emptyResult.getTotalPnLPercent());
        assertTrue(emptyResult.getAllocations().isEmpty());
    }

    @Test
    @DisplayName("calculate: 1 mã cổ phiếu có lãi -> kiểm tra PnL và tỷ trọng 100%")
    void testCalculate_singleHolding_profitScenario() {
        // Given
        Stock vnm = Stock.builder()
                .ticker("VNM")
                .companyName("Vinamilk")
                .currentPrice(new BigDecimal("88000.00"))
                .referencePrice(new BigDecimal("80000.00"))
                .build();

        Portfolio p1 = Portfolio.builder()
                .stock(vnm)
                .quantity(1000)
                .avgBuyPrice(new BigDecimal("80000.00")) // Cost = 80,000,000
                .build(); // Value = 88,000,000

        BigDecimal cash = new BigDecimal("20000000.00");

        // When
        PortfolioMetricsCalculator.CalculationResult result = calculator.calculate(List.of(p1), cash);

        // Then
        assertNotNull(result);
        assertEquals(new BigDecimal("108000000.00"), result.getTotalAssets()); // 88M + 20M
        assertEquals(new BigDecimal("88000000.00"), result.getTotalStockValue());
        assertEquals(new BigDecimal("80000000.00"), result.getTotalInvested());
        assertEquals(new BigDecimal("8000000.00"), result.getTotalPnL()); // +8,000,000
        assertEquals(10.0, result.getTotalPnLPercent()); // 10%
        assertEquals(1, result.getAllocations().size());

        PortfolioSummaryResponse.AllocationItem item = result.getAllocations().getFirst();
        assertEquals("VNM", item.getTicker());
        assertEquals(new BigDecimal("88000000.00"), item.getValue());
        assertEquals(100.0, item.getPercentage());
        assertEquals(TradingConstants.PORTFOLIO_CHART_PALETTE[0], item.getColor());
    }

    @Test
    @DisplayName("calculate: nhiều mã cổ phiếu -> kiểm tra tổng tài sản, tỷ trọng cộng dồn và gán màu chart palette")
    void testCalculate_multipleHoldings_allocationsAndPalette() {
        // Given
        Stock fpt = Stock.builder()
                .ticker("FPT")
                .companyName("FPT Corporation")
                .currentPrice(new BigDecimal("100000.00"))
                .build();

        Stock vcb = Stock.builder()
                .ticker("VCB")
                .companyName("Vietcombank")
                .currentPrice(new BigDecimal("90000.00"))
                .build();

        Portfolio p1 = Portfolio.builder()
                .stock(fpt)
                .quantity(600) // Value = 60,000,000
                .avgBuyPrice(new BigDecimal("90000.00")) // Cost = 54,000,000
                .build();

        Portfolio p2 = Portfolio.builder()
                .stock(vcb)
                .quantity(400) // Value = 36,000,000
                .avgBuyPrice(new BigDecimal("95000.00")) // Cost = 38,000,000
                .build();

        BigDecimal cash = new BigDecimal("4000000.00");

        // When
        PortfolioMetricsCalculator.CalculationResult result = calculator.calculate(List.of(p1, p2), cash);

        // Then
        // Total Stock Value = 60M + 36M = 96,000,000
        // Total Invested = 54M + 38M = 92,000,000
        // Total Assets = 96M + 4M = 100,000,000
        // Total PnL = 96M - 92M = 4,000,000
        assertEquals(new BigDecimal("100000000.00"), result.getTotalAssets());
        assertEquals(new BigDecimal("96000000.00"), result.getTotalStockValue());
        assertEquals(new BigDecimal("92000000.00"), result.getTotalInvested());
        assertEquals(new BigDecimal("4000000.00"), result.getTotalPnL());

        List<PortfolioSummaryResponse.AllocationItem> allocations = result.getAllocations();
        assertEquals(2, allocations.size());

        // FPT: 60M / 96M = 62.5%
        assertEquals("FPT", allocations.get(0).getTicker());
        assertEquals(62.5, allocations.get(0).getPercentage());
        assertEquals(TradingConstants.PORTFOLIO_CHART_PALETTE[0], allocations.get(0).getColor());

        // VCB: 36M / 96M = 37.5%
        assertEquals("VCB", allocations.get(1).getTicker());
        assertEquals(37.5, allocations.get(1).getPercentage());
        assertEquals(TradingConstants.PORTFOLIO_CHART_PALETTE[1], allocations.get(1).getColor());

        // Tổng tỷ trọng cổ phiếu = 62.5 + 37.5 = 100%
        assertEquals(100.0, allocations.get(0).getPercentage() + allocations.get(1).getPercentage(), 0.001);
    }

    @Test
    @DisplayName("calculate: xử lý phần tử null trong list một cách an toàn mà không văng NPE")
    void testCalculate_nullElementsInList_shouldIgnoreSafely() {
        // Given
        List<Portfolio> listWithNulls = new ArrayList<>();
        listWithNulls.add(null);
        listWithNulls.add(Portfolio.builder().stock(null).build());

        // When
        PortfolioMetricsCalculator.CalculationResult result = calculator.calculate(listWithNulls, BigDecimal.TEN);

        // Then
        assertNotNull(result);
        assertEquals(BigDecimal.TEN, result.getTotalAssets());
        assertEquals(BigDecimal.ZERO, result.getTotalStockValue());
        assertTrue(result.getAllocations().isEmpty());
    }
}

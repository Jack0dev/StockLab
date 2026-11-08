package com.stocklab.service.order;

import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.PortfolioRepository;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.OrderEstimateRequest;
import com.stocklab.presentation.dto.OrderEstimateResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrderEstimationService Unit Tests")
class OrderEstimationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @InjectMocks
    private OrderEstimationService orderEstimationService;

    private Stock hoseStock;
    private User testUser;

    @BeforeEach
    void setUp() {
        hoseStock = Stock.builder()
                .id(1L)
                .ticker("HPG")
                .companyName("Hoa Phat Group")
                .exchange("HOSE")
                .referencePrice(new BigDecimal("30000.00"))
                .currentPrice(new BigDecimal("30000.00"))
                .build();

        testUser = User.builder()
                .id(10L)
                .username("trader_pro")
                .balance(new BigDecimal("50000000.00"))
                .lockedBalance(BigDecimal.ZERO)
                .build();
    }

    @Test
    @DisplayName("estimateOrder: lệnh MUA hợp lệ trên sàn HOSE -> tính đúng phí, trần/sàn và trạng thái VALID")
    void testEstimateBuy_validOrder_shouldCalculateCorrectAmounts() {
        // Given
        when(stockRepository.findByTicker("HPG")).thenReturn(Optional.of(hoseStock));
        when(userRepository.findByUsername("trader_pro")).thenReturn(Optional.of(testUser));
        when(portfolioRepository.findByUserIdAndStockId(10L, 1L)).thenReturn(Optional.empty());

        OrderEstimateRequest request = OrderEstimateRequest.builder()
                .ticker("HPG")
                .side("BUY")
                .orderType("LO")
                .quantity(1000)
                .price(new BigDecimal("30000.00"))
                .build();

        // When
        ApiResponse<OrderEstimateResponse> response = orderEstimationService.estimateOrder("trader_pro", request);

        // Then
        assertTrue(response.isSuccess());
        OrderEstimateResponse data = response.getData();
        assertNotNull(data);
        assertTrue(data.isValid());
        assertEquals("VALID", data.getValidationCode());

        // Giá trần HOSE: 30000 * 1.07 = 32100.00, Sàn: 30000 * 0.93 = 27900.00
        assertEquals(new BigDecimal("32100.00"), data.getCeilingPrice());
        assertEquals(new BigDecimal("27900.00"), data.getFloorPrice());

        // Giá trị lệnh: 30,000 * 1000 = 30,000,000.00
        assertEquals(new BigDecimal("30000000.00"), data.getGrossAmount());
        // Phí mua 0.15%: 30,000,000 * 0.0015 = 45,000.00
        assertEquals(new BigDecimal("45000.00"), data.getFeeAmount());
        // Tổng thanh toán: 30,045,000.00
        assertEquals(new BigDecimal("30045000.00"), data.getTotalAmount());
        assertTrue(data.getMaxAffordableQuantity() >= 1000);
    }

    @Test
    @DisplayName("estimateOrder: khối lượng không chia hết cho 100 -> vi phạm lô chẵn INVALID_LOT_STEP")
    void testEstimate_invalidLotStep_shouldFailValidation() {
        // Given
        when(stockRepository.findByTicker("HPG")).thenReturn(Optional.of(hoseStock));

        OrderEstimateRequest request = OrderEstimateRequest.builder()
                .ticker("HPG")
                .side("BUY")
                .orderType("LO")
                .quantity(150) // Lô lẻ
                .price(new BigDecimal("30000.00"))
                .build();

        // When
        ApiResponse<OrderEstimateResponse> response = orderEstimationService.estimateOrder(null, request);

        // Then
        assertTrue(response.isSuccess());
        OrderEstimateResponse data = response.getData();
        assertFalse(data.isValid());
        assertEquals("INVALID_LOT_STEP", data.getValidationCode());
        assertTrue(data.getValidationMessage().contains("Lô chẵn"));
    }

    @Test
    @DisplayName("estimateOrder: giá đặt cao hơn giá trần HOSE (7%) -> vi phạm PRICE_ABOVE_CEILING")
    void testEstimate_priceAboveCeiling_shouldFailValidation() {
        // Given (Ceiling = 32,100)
        when(stockRepository.findByTicker("HPG")).thenReturn(Optional.of(hoseStock));

        OrderEstimateRequest request = OrderEstimateRequest.builder()
                .ticker("HPG")
                .side("BUY")
                .quantity(100)
                .price(new BigDecimal("35000.00")) // Vượt trần
                .build();

        // When
        ApiResponse<OrderEstimateResponse> response = orderEstimationService.estimateOrder(null, request);

        // Then
        assertTrue(response.isSuccess());
        OrderEstimateResponse data = response.getData();
        assertFalse(data.isValid());
        assertEquals("PRICE_ABOVE_CEILING", data.getValidationCode());
    }

    @Test
    @DisplayName("estimateOrder: giá đặt thấp hơn giá sàn HOSE (7%) -> vi phạm PRICE_BELOW_FLOOR")
    void testEstimate_priceBelowFloor_shouldFailValidation() {
        // Given (Floor = 27,900)
        when(stockRepository.findByTicker("HPG")).thenReturn(Optional.of(hoseStock));

        OrderEstimateRequest request = OrderEstimateRequest.builder()
                .ticker("HPG")
                .side("BUY")
                .quantity(100)
                .price(new BigDecimal("25000.00")) // Dưới sàn
                .build();

        // When
        ApiResponse<OrderEstimateResponse> response = orderEstimationService.estimateOrder(null, request);

        // Then
        assertTrue(response.isSuccess());
        OrderEstimateResponse data = response.getData();
        assertFalse(data.isValid());
        assertEquals("PRICE_BELOW_FLOOR", data.getValidationCode());
    }

    @Test
    @DisplayName("estimateOrder: số dư tiền mặt không đủ thanh toán -> vi phạm INSUFFICIENT_FUNDS")
    void testEstimateBuy_insufficientFunds_shouldFailValidation() {
        // Given
        User poorUser = User.builder()
                .id(20L)
                .username("low_cash_trader")
                .balance(new BigDecimal("500000.00")) // Chỉ có 500k
                .lockedBalance(BigDecimal.ZERO)
                .build();

        when(stockRepository.findByTicker("HPG")).thenReturn(Optional.of(hoseStock));
        when(userRepository.findByUsername("low_cash_trader")).thenReturn(Optional.of(poorUser));
        when(portfolioRepository.findByUserIdAndStockId(20L, 1L)).thenReturn(Optional.empty());

        OrderEstimateRequest request = OrderEstimateRequest.builder()
                .ticker("HPG")
                .side("BUY")
                .quantity(100)
                .price(new BigDecimal("30000.00")) // Cần ~3,004,500 đ
                .build();

        // When
        ApiResponse<OrderEstimateResponse> response = orderEstimationService.estimateOrder("low_cash_trader", request);

        // Then
        assertTrue(response.isSuccess());
        OrderEstimateResponse data = response.getData();
        assertFalse(data.isValid());
        assertEquals("INSUFFICIENT_FUNDS", data.getValidationCode());
    }

    @Test
    @DisplayName("estimateOrder: bán vượt quá số lượng khả dụng trong danh mục -> vi phạm INSUFFICIENT_HOLDINGS")
    void testEstimateSell_insufficientHoldings_shouldFailValidation() {
        // Given
        Portfolio userHolding = Portfolio.builder()
                .id(1L)
                .quantity(300)
                .lockedQuantity(100) // Khả dụng = 200
                .avgBuyPrice(new BigDecimal("29000.00"))
                .build();

        when(stockRepository.findByTicker("HPG")).thenReturn(Optional.of(hoseStock));
        when(userRepository.findByUsername("trader_pro")).thenReturn(Optional.of(testUser));
        when(portfolioRepository.findByUserIdAndStockId(10L, 1L)).thenReturn(Optional.of(userHolding));

        OrderEstimateRequest request = OrderEstimateRequest.builder()
                .ticker("HPG")
                .side("SELL")
                .quantity(300) // Đòi bán 300 trong khi khả dụng chỉ có 200
                .price(new BigDecimal("30000.00"))
                .build();

        // When
        ApiResponse<OrderEstimateResponse> response = orderEstimationService.estimateOrder("trader_pro", request);

        // Then
        assertTrue(response.isSuccess());
        OrderEstimateResponse data = response.getData();
        assertFalse(data.isValid());
        assertEquals("INSUFFICIENT_HOLDINGS", data.getValidationCode());
        assertEquals(200, data.getAvailableHoldings());
    }

    @Test
    @DisplayName("estimateOrder: không tìm thấy mã cổ phiếu -> trả về phản hồi lỗi")
    void testEstimate_stockNotFound_shouldReturnError() {
        // Given
        when(stockRepository.findByTicker("UNKNOWN")).thenReturn(Optional.empty());

        OrderEstimateRequest request = OrderEstimateRequest.builder()
                .ticker("UNKNOWN")
                .build();

        // When
        ApiResponse<OrderEstimateResponse> response = orderEstimationService.estimateOrder("trader_pro", request);

        // Then
        assertFalse(response.isSuccess());
        assertTrue(response.getMessage().contains("Không tìm thấy mã cổ phiếu"));
    }
}

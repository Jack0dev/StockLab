package com.stocklab.engine;

import com.stocklab.model.*;
import com.stocklab.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MatchingEngine Tests")
class MatchingEngineTest {

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private MatchingEngine matchingEngine;

    private Stock testStock;
    private User buyer;
    private User seller;

    @BeforeEach
    void setUp() {
        testStock = Stock.builder()
                .id(1L)
                .ticker("VNM")
                .companyName("Vinamilk")
                .currentPrice(new BigDecimal("85000.00"))
                .build();

        buyer = User.builder()
                .id(1L).username("buyer")
                .balance(new BigDecimal("10000000.00"))
                .lockedBalance(BigDecimal.ZERO)
                .build();

        seller = User.builder()
                .id(2L).username("seller")
                .balance(new BigDecimal("10000000.00"))
                .lockedBalance(BigDecimal.ZERO)
                .build();
    }

    // ===== Helper: tạo Order =====

    private Order createOrder(User user, OrderSide side, OrderType orderType,
                              BigDecimal price, int quantity, OrderStatus status) {
        return Order.builder()
                .id((long) (Math.random() * 10000))
                .user(user)
                .stock(testStock)
                .side(side)
                .orderType(orderType)
                .price(price)
                .quantity(quantity)
                .filledQuantity(0)
                .status(status)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private Order createLimitBuy(BigDecimal price, int qty) {
        return createOrder(buyer, OrderSide.BUY, OrderType.LIMIT, price, qty, OrderStatus.ACTIVE);
    }

    private Order createLimitSell(BigDecimal price, int qty) {
        return createOrder(seller, OrderSide.SELL, OrderType.LIMIT, price, qty, OrderStatus.ACTIVE);
    }

    private Order createMarketBuy(int qty) {
        return createOrder(buyer, OrderSide.BUY, OrderType.MARKET, testStock.getCurrentPrice(), qty, OrderStatus.ACTIVE);
    }

    private Order createMarketSell(int qty) {
        return createOrder(seller, OrderSide.SELL, OrderType.MARKET, testStock.getCurrentPrice(), qty, OrderStatus.ACTIVE);
    }

    // ===== LIMIT Order Matching =====

    @Nested
    @DisplayName("LIMIT Order Matching (ME-3)")
    class LimitOrderTests {

        @Test
        @DisplayName("LIMIT BUY 85k × LIMIT SELL 85k → khớp tại 85k")
        void shouldMatchWhenBuyPriceEqualsSellPrice() {
            Order buyOrder = createLimitBuy(new BigDecimal("85000"), 10);
            Order sellOrder = createLimitSell(new BigDecimal("85000"), 10);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(1, results.size());
            MatchResult result = results.get(0);
            assertEquals(new BigDecimal("85000"), result.getMatchPrice());
            assertEquals(10, result.getMatchQuantity());
            assertEquals(OrderStatus.FILLED, buyOrder.getStatus());
            assertEquals(OrderStatus.FILLED, sellOrder.getStatus());
        }

        @Test
        @DisplayName("LIMIT BUY 85k × LIMIT SELL 86k → không khớp (buyPrice < sellPrice)")
        void shouldNotMatchWhenBuyPriceLessThanSellPrice() {
            Order buyOrder = createLimitBuy(new BigDecimal("85000"), 10);
            Order sellOrder = createLimitSell(new BigDecimal("86000"), 10);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertTrue(results.isEmpty());
            assertEquals(OrderStatus.ACTIVE, buyOrder.getStatus());
            assertEquals(OrderStatus.ACTIVE, sellOrder.getStatus());
        }

        @Test
        @DisplayName("LIMIT BUY 86k × LIMIT SELL 85k → khớp tại giá seller (maker price)")
        void shouldMatchAtSellerPriceWhenBuyPriceHigher() {
            Order buyOrder = createLimitBuy(new BigDecimal("86000"), 10);
            Order sellOrder = createLimitSell(new BigDecimal("85000"), 10);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(1, results.size());
            // Giá khớp = giá lệnh đến trước (sell là maker) = 85000
            assertEquals(new BigDecimal("85000"), results.get(0).getMatchPrice());
        }
    }

    // ===== MARKET Order Matching =====

    @Nested
    @DisplayName("MARKET Order Matching (ME-2)")
    class MarketOrderTests {

        @Test
        @DisplayName("MARKET BUY × LIMIT SELL → khớp tại giá SELL tốt nhất")
        void shouldMatchMarketBuyWithBestSellPrice() {
            Order buyOrder = createMarketBuy(10);
            Order sellOrder = createLimitSell(new BigDecimal("84000"), 10);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(1, results.size());
            assertEquals(new BigDecimal("84000"), results.get(0).getMatchPrice());
            assertEquals(OrderStatus.FILLED, buyOrder.getStatus());
        }

        @Test
        @DisplayName("MARKET BUY × không có SELL → lệnh bị CANCELLED")
        void shouldCancelMarketBuyWhenNoSellOrders() {
            Order buyOrder = createMarketBuy(10);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of());

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertTrue(results.isEmpty());
            assertEquals(OrderStatus.CANCELLED, buyOrder.getStatus());
        }

        @Test
        @DisplayName("LIMIT BUY × MARKET SELL → khớp tại giá BUY tốt nhất")
        void shouldMatchMarketSellWithBestBuyPrice() {
            Order buyOrder = createLimitBuy(new BigDecimal("86000"), 10);
            Order sellOrder = createMarketSell(10);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(1, results.size());
            assertEquals(new BigDecimal("86000"), results.get(0).getMatchPrice());
            assertEquals(OrderStatus.FILLED, sellOrder.getStatus());
        }

        @Test
        @DisplayName("MARKET SELL × không có BUY → lệnh bị CANCELLED")
        void shouldCancelMarketSellWhenNoBuyOrders() {
            Order sellOrder = createMarketSell(10);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of());
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertTrue(results.isEmpty());
            assertEquals(OrderStatus.CANCELLED, sellOrder.getStatus());
        }
    }

    // ===== Partial Fill =====

    @Nested
    @DisplayName("Partial Fill")
    class PartialFillTests {

        @Test
        @DisplayName("BUY 100 × SELL 60 → BUY PARTIAL (filled=60), SELL FILLED")
        void shouldPartialFillBuyWhenSellQuantityLess() {
            Order buyOrder = createLimitBuy(new BigDecimal("85000"), 100);
            Order sellOrder = createLimitSell(new BigDecimal("85000"), 60);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(1, results.size());
            assertEquals(60, results.get(0).getMatchQuantity());
            assertEquals(60, buyOrder.getFilledQuantity());
            assertEquals(OrderStatus.PARTIALLY_FILLED, buyOrder.getStatus());
            assertEquals(60, sellOrder.getFilledQuantity());
            assertEquals(OrderStatus.FILLED, sellOrder.getStatus());
        }

        @Test
        @DisplayName("BUY 50 × SELL 100 → BUY FILLED, SELL PARTIAL (filled=50)")
        void shouldPartialFillSellWhenBuyQuantityLess() {
            Order buyOrder = createLimitBuy(new BigDecimal("85000"), 50);
            Order sellOrder = createLimitSell(new BigDecimal("85000"), 100);

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrder));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(1, results.size());
            assertEquals(50, results.get(0).getMatchQuantity());
            assertEquals(OrderStatus.FILLED, buyOrder.getStatus());
            assertEquals(50, sellOrder.getFilledQuantity());
            assertEquals(OrderStatus.PARTIALLY_FILLED, sellOrder.getStatus());
        }
    }

    // ===== Price-Time Priority (ME-1) =====

    @Nested
    @DisplayName("Price-Time Priority (ME-1)")
    class PriceTimePriorityTests {

        @Test
        @DisplayName("2 SELL cùng giá → lệnh đặt trước khớp trước (FIFO)")
        void shouldMatchOlderOrderFirstWhenSamePrice() {
            Order buyOrder = createLimitBuy(new BigDecimal("85000"), 10);

            Order sellOrderEarly = createLimitSell(new BigDecimal("85000"), 10);
            sellOrderEarly.setId(100L);
            sellOrderEarly.setCreatedAt(LocalDateTime.of(2026, 3, 24, 10, 0));

            Order sellOrderLate = createLimitSell(new BigDecimal("85000"), 10);
            sellOrderLate.setId(101L);
            sellOrderLate.setCreatedAt(LocalDateTime.of(2026, 3, 24, 10, 5));

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            // Repo trả về theo thứ tự: giá tăng → cùng giá thì FIFO
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sellOrderEarly, sellOrderLate));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(1, results.size());
            assertSame(sellOrderEarly, results.get(0).getSellOrder());
            assertEquals(OrderStatus.FILLED, sellOrderEarly.getStatus());
            // sellOrderLate vẫn PENDING vì BUY đã filled hết
            assertEquals(OrderStatus.ACTIVE, sellOrderLate.getStatus());
        }

        @Test
        @DisplayName("Multi-match: BUY 100 × SELL 30 + SELL 40 + SELL 30 → BUY FILLED")
        void shouldMatchMultipleSellOrders() {
            Order buyOrder = createLimitBuy(new BigDecimal("85000"), 100);

            Order sell1 = createLimitSell(new BigDecimal("85000"), 30);
            sell1.setId(201L);
            sell1.setCreatedAt(LocalDateTime.of(2026, 3, 24, 10, 0));

            Order sell2 = createLimitSell(new BigDecimal("85000"), 40);
            sell2.setId(202L);
            sell2.setCreatedAt(LocalDateTime.of(2026, 3, 24, 10, 1));

            Order sell3 = createLimitSell(new BigDecimal("85000"), 30);
            sell3.setId(203L);
            sell3.setCreatedAt(LocalDateTime.of(2026, 3, 24, 10, 2));

            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of(buyOrder));
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of(sell1, sell2, sell3));

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertEquals(3, results.size());
            assertEquals(30, results.get(0).getMatchQuantity());
            assertEquals(40, results.get(1).getMatchQuantity());
            assertEquals(30, results.get(2).getMatchQuantity());

            assertEquals(100, buyOrder.getFilledQuantity());
            assertEquals(OrderStatus.FILLED, buyOrder.getStatus());
            assertEquals(OrderStatus.FILLED, sell1.getStatus());
            assertEquals(OrderStatus.FILLED, sell2.getStatus());
            assertEquals(OrderStatus.FILLED, sell3.getStatus());
        }

        @Test
        @DisplayName("Không có lệnh nào → trả về list rỗng")
        void shouldReturnEmptyWhenNoOrders() {
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
                    1L, OrderSide.BUY, OrderStatus.ACTIVE))
                    .thenReturn(List.of());
            when(orderRepository.findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
                    1L, OrderSide.SELL, OrderStatus.ACTIVE))
                    .thenReturn(List.of());

            List<MatchResult> results = matchingEngine.matchOrders(testStock);

            assertTrue(results.isEmpty());
        }
    }
}

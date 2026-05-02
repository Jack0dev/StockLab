package com.stocklab.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Order Entity Tests")
class OrderTest {

    // ===== Builder & Default Values =====

    @Nested
    @DisplayName("Khi tạo Order mới bằng Builder")
    class BuilderTests {

        @Test
        @DisplayName("filledQuantity mặc định = 0")
        void shouldHaveZeroFilledQuantityByDefault() {
            Order order = Order.builder()
                    .quantity(100)
                    .side(OrderSide.BUY)
                    .orderType(OrderType.LIMIT)
                    .build();

            assertEquals(0, order.getFilledQuantity());
        }

        @Test
        @DisplayName("status mặc định = PENDING")
        void shouldHavePendingStatusByDefault() {
            Order order = Order.builder()
                    .quantity(100)
                    .side(OrderSide.BUY)
                    .orderType(OrderType.LIMIT)
                    .build();

            assertEquals(OrderStatus.ACTIVE, order.getStatus());
        }

        @Test
        @DisplayName("Tạo lệnh LIMIT đầy đủ thông tin")
        void shouldCreateLimitOrderWithAllFields() {
            Order order = Order.builder()
                    .side(OrderSide.BUY)
                    .orderType(OrderType.LIMIT)
                    .quantity(100)
                    .price(new BigDecimal("25000.00"))
                    .build();

            assertEquals(OrderSide.BUY, order.getSide());
            assertEquals(OrderType.LIMIT, order.getOrderType());
            assertEquals(100, order.getQuantity());
            assertEquals(new BigDecimal("25000.00"), order.getPrice());
            assertEquals(OrderStatus.ACTIVE, order.getStatus());
            assertEquals(0, order.getFilledQuantity());
        }

        @Test
        @DisplayName("Tạo lệnh MARKET — price = null")
        void shouldCreateMarketOrderWithNullPrice() {
            Order order = Order.builder()
                    .side(OrderSide.SELL)
                    .orderType(OrderType.MARKET)
                    .quantity(50)
                    .build();

            assertEquals(OrderType.MARKET, order.getOrderType());
            assertNull(order.getPrice());
        }
    }

    // ===== getRemainingQuantity() =====

    @Nested
    @DisplayName("getRemainingQuantity()")
    class RemainingQuantityTests {

        @Test
        @DisplayName("Lệnh mới — remaining = quantity")
        void shouldReturnFullQuantityWhenNoFill() {
            Order order = Order.builder()
                    .quantity(100)
                    .build();

            assertEquals(100, order.getRemainingQuantity());
        }

        @Test
        @DisplayName("Lệnh đã khớp 1 phần — remaining = quantity - filledQuantity")
        void shouldReturnCorrectRemainingAfterPartialFill() {
            Order order = Order.builder()
                    .quantity(100)
                    .filledQuantity(30)
                    .build();

            assertEquals(70, order.getRemainingQuantity());
        }

        @Test
        @DisplayName("Lệnh đã khớp hết — remaining = 0")
        void shouldReturnZeroWhenFullyFilled() {
            Order order = Order.builder()
                    .quantity(100)
                    .filledQuantity(100)
                    .build();

            assertEquals(0, order.getRemainingQuantity());
        }
    }

    // ===== isCancellable() =====

    @Nested
    @DisplayName("isCancellable()")
    class CancellableTests {

        @Test
        @DisplayName("Lệnh PENDING → có thể hủy")
        void shouldBeCancellableWhenPending() {
            Order order = Order.builder()
                    .status(OrderStatus.ACTIVE)
                    .quantity(100)
                    .build();

            assertTrue(order.isCancellable());
        }

        @Test
        @DisplayName("Lệnh PARTIAL → có thể hủy")
        void shouldBeCancellableWhenPartial() {
            Order order = Order.builder()
                    .status(OrderStatus.PARTIALLY_FILLED)
                    .quantity(100)
                    .filledQuantity(30)
                    .build();

            assertTrue(order.isCancellable());
        }

        @Test
        @DisplayName("Lệnh FILLED → KHÔNG thể hủy")
        void shouldNotBeCancellableWhenFilled() {
            Order order = Order.builder()
                    .status(OrderStatus.FILLED)
                    .quantity(100)
                    .filledQuantity(100)
                    .build();

            assertFalse(order.isCancellable());
        }

        @Test
        @DisplayName("Lệnh CANCELLED → KHÔNG thể hủy")
        void shouldNotBeCancellableWhenAlreadyCancelled() {
            Order order = Order.builder()
                    .status(OrderStatus.CANCELLED)
                    .quantity(100)
                    .build();

            assertFalse(order.isCancellable());
        }

        @Test
        @DisplayName("Lệnh REJECTED → KHÔNG thể hủy")
        void shouldNotBeCancellableWhenRejected() {
            Order order = Order.builder()
                    .status(OrderStatus.EXPIRED)
                    .quantity(100)
                    .build();

            assertFalse(order.isCancellable());
        }
    }

    // ===== Setter Tests =====

    @Nested
    @DisplayName("Cập nhật trạng thái lệnh")
    class StatusUpdateTests {

        @Test
        @DisplayName("Chuyển status từ PENDING → PARTIAL khi khớp 1 phần")
        void shouldUpdateToPartialStatus() {
            Order order = Order.builder()
                    .quantity(100)
                    .status(OrderStatus.ACTIVE)
                    .build();

            order.setFilledQuantity(30);
            order.setStatus(OrderStatus.PARTIALLY_FILLED);

            assertEquals(OrderStatus.PARTIALLY_FILLED, order.getStatus());
            assertEquals(30, order.getFilledQuantity());
            assertEquals(70, order.getRemainingQuantity());
        }

        @Test
        @DisplayName("Chuyển status từ PARTIAL → FILLED khi khớp hết")
        void shouldUpdateToFilledStatus() {
            Order order = Order.builder()
                    .quantity(100)
                    .filledQuantity(30)
                    .status(OrderStatus.PARTIALLY_FILLED)
                    .build();

            order.setFilledQuantity(100);
            order.setStatus(OrderStatus.FILLED);

            assertEquals(OrderStatus.FILLED, order.getStatus());
            assertEquals(0, order.getRemainingQuantity());
        }
    }
}

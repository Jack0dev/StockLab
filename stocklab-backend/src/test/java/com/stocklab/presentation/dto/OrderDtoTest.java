package com.stocklab.presentation.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("OMS DTO Tests")
class OrderDtoTest {

    // ===== OrderRequest =====

    @Nested
    @DisplayName("OrderRequest")
    class OrderRequestTests {

        @Test
        @DisplayName("Tạo OrderRequest LIMIT đầy đủ")
        void shouldCreateLimitOrderRequest() {
            OrderRequest request = OrderRequest.builder()
                    .ticker("VNM")
                    .side("BUY")
                    .orderType("LIMIT")
                    .quantity(100)
                    .price(new BigDecimal("85000.00"))
                    .build();

            assertEquals("VNM", request.getTicker());
            assertEquals("BUY", request.getSide());
            assertEquals("LIMIT", request.getOrderType());
            assertEquals(100, request.getQuantity());
            assertEquals(new BigDecimal("85000.00"), request.getPrice());
        }

        @Test
        @DisplayName("Tạo OrderRequest MARKET — price = null")
        void shouldCreateMarketOrderRequestWithoutPrice() {
            OrderRequest request = OrderRequest.builder()
                    .ticker("FPT")
                    .side("SELL")
                    .orderType("MARKET")
                    .quantity(50)
                    .build();

            assertEquals("MARKET", request.getOrderType());
            assertNull(request.getPrice());
        }
    }

    // ===== OrderResponse =====

    @Nested
    @DisplayName("OrderResponse")
    class OrderResponseTests {

        @Test
        @DisplayName("Tạo OrderResponse đầy đủ")
        void shouldCreateFullOrderResponse() {
            LocalDateTime now = LocalDateTime.now();
            OrderResponse response = OrderResponse.builder()
                    .id(1L)
                    .ticker("VNM")
                    .companyName("Vinamilk")
                    .side("BUY")
                    .orderType("LIMIT")
                    .quantity(100)
                    .filledQuantity(30)
                    .price(new BigDecimal("85000.00"))
                    .status("PARTIAL")
                    .createdAt(now)
                    .build();

            assertEquals(1L, response.getId());
            assertEquals("VNM", response.getTicker());
            assertEquals("Vinamilk", response.getCompanyName());
            assertEquals("BUY", response.getSide());
            assertEquals("LIMIT", response.getOrderType());
            assertEquals(100, response.getQuantity());
            assertEquals(30, response.getFilledQuantity());
            assertEquals("PARTIAL", response.getStatus());
            assertEquals(now, response.getCreatedAt());
        }
    }

    // ===== OrderBookResponse =====

    @Nested
    @DisplayName("OrderBookResponse")
    class OrderBookResponseTests {

        @Test
        @DisplayName("Tạo OrderBookEntry")
        void shouldCreateOrderBookEntry() {
            OrderBookResponse.OrderBookEntry entry = OrderBookResponse.OrderBookEntry.builder()
                    .price(new BigDecimal("85000.00"))
                    .totalQuantity(500)
                    .orderCount(3)
                    .build();

            assertEquals(new BigDecimal("85000.00"), entry.getPrice());
            assertEquals(500, entry.getTotalQuantity());
            assertEquals(3, entry.getOrderCount());
        }

        @Test
        @DisplayName("Tạo OrderBookResponse với bids và asks")
        void shouldCreateOrderBookWithBidsAndAsks() {
            OrderBookResponse.OrderBookEntry bid1 = OrderBookResponse.OrderBookEntry.builder()
                    .price(new BigDecimal("85000.00"))
                    .totalQuantity(500)
                    .orderCount(3)
                    .build();

            OrderBookResponse.OrderBookEntry bid2 = OrderBookResponse.OrderBookEntry.builder()
                    .price(new BigDecimal("84500.00"))
                    .totalQuantity(300)
                    .orderCount(2)
                    .build();

            OrderBookResponse.OrderBookEntry ask1 = OrderBookResponse.OrderBookEntry.builder()
                    .price(new BigDecimal("85500.00"))
                    .totalQuantity(200)
                    .orderCount(1)
                    .build();

            OrderBookResponse orderBook = OrderBookResponse.builder()
                    .ticker("VNM")
                    .companyName("Vinamilk")
                    .bids(List.of(bid1, bid2))
                    .asks(List.of(ask1))
                    .build();

            assertEquals("VNM", orderBook.getTicker());
            assertEquals(2, orderBook.getBids().size());
            assertEquals(1, orderBook.getAsks().size());

            // Bids: giá giảm dần
            assertTrue(orderBook.getBids().get(0).getPrice()
                    .compareTo(orderBook.getBids().get(1).getPrice()) > 0);
        }

        @Test
        @DisplayName("OrderBook rỗng — bids & asks rỗng")
        void shouldHandleEmptyOrderBook() {
            OrderBookResponse orderBook = OrderBookResponse.builder()
                    .ticker("VNM")
                    .companyName("Vinamilk")
                    .bids(List.of())
                    .asks(List.of())
                    .build();

            assertTrue(orderBook.getBids().isEmpty());
            assertTrue(orderBook.getAsks().isEmpty());
        }
    }
}

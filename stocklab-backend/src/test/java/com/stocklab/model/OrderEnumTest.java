package com.stocklab.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Order Enum Tests")
class OrderEnumTest {

    // ===== OrderType =====

    @Test
    @DisplayName("OrderType phải có 2 giá trị: MARKET, LIMIT")
    void orderTypeShouldHaveTwoValues() {
        OrderType[] values = OrderType.values();
        assertEquals(2, values.length);
        assertEquals(OrderType.MARKET, OrderType.valueOf("MARKET"));
        assertEquals(OrderType.LIMIT, OrderType.valueOf("LIMIT"));
    }

    @Test
    @DisplayName("OrderType.valueOf với giá trị không hợp lệ → exception")
    void orderTypeInvalidValueShouldThrow() {
        assertThrows(IllegalArgumentException.class, () ->
                OrderType.valueOf("STOP_LOSS"));
    }

    // ===== OrderStatus =====

    @Test
    @DisplayName("OrderStatus phải có 5 giá trị")
    void orderStatusShouldHaveFiveValues() {
        OrderStatus[] values = OrderStatus.values();
        assertEquals(5, values.length);
        assertEquals(OrderStatus.ACTIVE, OrderStatus.valueOf("PENDING"));
        assertEquals(OrderStatus.PARTIALLY_FILLED, OrderStatus.valueOf("PARTIAL"));
        assertEquals(OrderStatus.FILLED, OrderStatus.valueOf("FILLED"));
        assertEquals(OrderStatus.CANCELLED, OrderStatus.valueOf("CANCELLED"));
        assertEquals(OrderStatus.CANCELLED, OrderStatus.valueOf("REJECTED"));
    }

    @Test
    @DisplayName("OrderStatus.valueOf với giá trị không hợp lệ → exception")
    void orderStatusInvalidValueShouldThrow() {
        assertThrows(IllegalArgumentException.class, () ->
                OrderStatus.valueOf("EXPIRED"));
    }

    // ===== OrderSide =====

    @Test
    @DisplayName("OrderSide phải có 2 giá trị: BUY, SELL")
    void orderSideShouldHaveTwoValues() {
        OrderSide[] values = OrderSide.values();
        assertEquals(2, values.length);
        assertEquals(OrderSide.BUY, OrderSide.valueOf("BUY"));
        assertEquals(OrderSide.SELL, OrderSide.valueOf("SELL"));
    }

    @Test
    @DisplayName("OrderSide.valueOf với giá trị không hợp lệ → exception")
    void orderSideInvalidValueShouldThrow() {
        assertThrows(IllegalArgumentException.class, () ->
                OrderSide.valueOf("SHORT"));
    }
}

package com.stocklab.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Order Enum Tests")
class OrderEnumTest {

    // ===== OrderType =====

    @Test
    @DisplayName("OrderType phải có 9 giá trị")
    void orderTypeShouldHaveNineValues() {
        OrderType[] values = OrderType.values();
        assertEquals(9, values.length);
        assertEquals(OrderType.MARKET, OrderType.valueOf("MARKET"));
        assertEquals(OrderType.LIMIT, OrderType.valueOf("LIMIT"));
        assertEquals(OrderType.STOP_MARKET, OrderType.valueOf("STOP_MARKET"));
        assertEquals(OrderType.STOP_LIMIT, OrderType.valueOf("STOP_LIMIT"));
        assertEquals(OrderType.TAKE_PROFIT, OrderType.valueOf("TAKE_PROFIT"));
        assertEquals(OrderType.TAKE_PROFIT_LIMIT, OrderType.valueOf("TAKE_PROFIT_LIMIT"));
        assertEquals(OrderType.TRAILING_STOP, OrderType.valueOf("TRAILING_STOP"));
        assertEquals(OrderType.TRAILING_STOP_LIMIT, OrderType.valueOf("TRAILING_STOP_LIMIT"));
        assertEquals(OrderType.OCO, OrderType.valueOf("OCO"));
    }

    @Test
    @DisplayName("OrderType.valueOf với giá trị không hợp lệ → exception")
    void orderTypeInvalidValueShouldThrow() {
        assertThrows(IllegalArgumentException.class, () ->
                OrderType.valueOf("STOP_LOSS"));
    }

    // ===== OrderStatus =====

    @Test
    @DisplayName("OrderStatus phải có 6 giá trị")
    void orderStatusShouldHaveSixValues() {
        OrderStatus[] values = OrderStatus.values();
        assertEquals(6, values.length);
        assertEquals(OrderStatus.PENDING_TRIGGER, OrderStatus.valueOf("PENDING_TRIGGER"));
        assertEquals(OrderStatus.ACTIVE, OrderStatus.valueOf("ACTIVE"));
        assertEquals(OrderStatus.PARTIALLY_FILLED, OrderStatus.valueOf("PARTIALLY_FILLED"));
        assertEquals(OrderStatus.FILLED, OrderStatus.valueOf("FILLED"));
        assertEquals(OrderStatus.CANCELLED, OrderStatus.valueOf("CANCELLED"));
        assertEquals(OrderStatus.EXPIRED, OrderStatus.valueOf("EXPIRED"));
    }

    @Test
    @DisplayName("OrderStatus.valueOf với giá trị không hợp lệ → exception")
    void orderStatusInvalidValueShouldThrow() {
        assertThrows(IllegalArgumentException.class, () ->
                OrderStatus.valueOf("REJECTED"));
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

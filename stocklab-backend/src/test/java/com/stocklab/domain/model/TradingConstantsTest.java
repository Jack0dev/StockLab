package com.stocklab.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class TradingConstantsTest {

    @Test
    @DisplayName("HOSE exchange calculates +/- 7% ceiling and floor accurately")
    void testHoseCeilingAndFloor() {
        BigDecimal ref = new BigDecimal("100000.00");
        BigDecimal ceiling = TradingConstants.calculateCeilingPrice(ref, "HOSE");
        BigDecimal floor = TradingConstants.calculateFloorPrice(ref, "HOSE");

        assertEquals(new BigDecimal("107000.00"), ceiling);
        assertEquals(new BigDecimal("93000.00"), floor);
    }

    @Test
    @DisplayName("HNX exchange calculates +/- 10% ceiling and floor accurately")
    void testHnxCeilingAndFloor() {
        BigDecimal ref = new BigDecimal("20000.00");
        BigDecimal ceiling = TradingConstants.calculateCeilingPrice(ref, "HNX");
        BigDecimal floor = TradingConstants.calculateFloorPrice(ref, "HNX");

        assertEquals(new BigDecimal("22000.00"), ceiling);
        assertEquals(new BigDecimal("18000.00"), floor);
    }

    @Test
    @DisplayName("UPCOM exchange calculates +/- 15% ceiling and floor accurately")
    void testUpcomCeilingAndFloor() {
        BigDecimal ref = new BigDecimal("50000.00");
        BigDecimal ceiling = TradingConstants.calculateCeilingPrice(ref, "UPCOM");
        BigDecimal floor = TradingConstants.calculateFloorPrice(ref, "UPCOM");

        assertEquals(new BigDecimal("57500.00"), ceiling);
        assertEquals(new BigDecimal("42500.00"), floor);
    }

    @Test
    @DisplayName("Null reference price returns null safely")
    void testNullReferencePrice() {
        assertNull(TradingConstants.calculateCeilingPrice(null, "HOSE"));
        assertNull(TradingConstants.calculateFloorPrice(null, "HOSE"));
    }

    @Test
    @DisplayName("Unknown or null exchange defaults to HOSE 7%")
    void testDefaultExchange() {
        BigDecimal ref = new BigDecimal("10000.00");
        assertEquals(new BigDecimal("10700.00"), TradingConstants.calculateCeilingPrice(ref, null));
        assertEquals(new BigDecimal("9300.00"), TradingConstants.calculateFloorPrice(ref, "UNKNOWN"));
    }
}

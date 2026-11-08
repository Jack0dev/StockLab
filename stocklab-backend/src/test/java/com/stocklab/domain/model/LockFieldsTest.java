package com.stocklab.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("User & Portfolio — Lock Fields Tests")
class LockFieldsTest {

    // ===== User.lockedBalance =====

    @Nested
    @DisplayName("User.lockedBalance")
    class UserLockedBalanceTests {

        @Test
        @DisplayName("lockedBalance mặc định = 0")
        void shouldHaveZeroLockedBalanceByDefault() {
            User user = User.builder()
                    .username("testuser")
                    .email("test@test.com")
                    .password("password")
                    .build();

            assertEquals(BigDecimal.ZERO, user.getLockedBalance());
        }

        @Test
        @DisplayName("getAvailableBalance() = balance - lockedBalance")
        void shouldCalculateAvailableBalanceCorrectly() {
            User user = User.builder()
                    .username("testuser")
                    .email("test@test.com")
                    .password("password")
                    .balance(new BigDecimal("10000000.00"))
                    .lockedBalance(new BigDecimal("2500000.00"))
                    .build();

            BigDecimal expected = new BigDecimal("7500000.00");
            assertEquals(expected, user.getAvailableBalance());
        }

        @Test
        @DisplayName("getAvailableBalance() khi lockedBalance = 0 → trả về full balance")
        void shouldReturnFullBalanceWhenNothingLocked() {
            User user = User.builder()
                    .username("testuser")
                    .email("test@test.com")
                    .password("password")
                    .balance(new BigDecimal("10000000.00"))
                    .build();

            assertEquals(new BigDecimal("10000000.00"), user.getAvailableBalance());
        }

        @Test
        @DisplayName("getAvailableBalance() khi lockedBalance = balance → trả về 0")
        void shouldReturnZeroWhenAllLocked() {
            BigDecimal fullBalance = new BigDecimal("10000000.00");
            User user = User.builder()
                    .username("testuser")
                    .email("test@test.com")
                    .password("password")
                    .balance(fullBalance)
                    .lockedBalance(fullBalance)
                    .build();

            assertEquals(0, user.getAvailableBalance().compareTo(BigDecimal.ZERO));
        }
    }

    // ===== Portfolio.lockedQuantity =====

    @Nested
    @DisplayName("Portfolio.lockedQuantity")
    class PortfolioLockedQuantityTests {

        @Test
        @DisplayName("lockedQuantity mặc định = 0")
        void shouldHaveZeroLockedQuantityByDefault() {
            Portfolio portfolio = Portfolio.builder()
                    .quantity(100)
                    .build();

            assertEquals(0, portfolio.getLockedQuantity());
        }

        @Test
        @DisplayName("getAvailableQuantity() = quantity - lockedQuantity")
        void shouldCalculateAvailableQuantityCorrectly() {
            Portfolio portfolio = Portfolio.builder()
                    .quantity(100)
                    .lockedQuantity(30)
                    .build();

            assertEquals(70, portfolio.getAvailableQuantity());
        }

        @Test
        @DisplayName("getAvailableQuantity() khi lockedQuantity = 0 → trả về full quantity")
        void shouldReturnFullQuantityWhenNothingLocked() {
            Portfolio portfolio = Portfolio.builder()
                    .quantity(100)
                    .build();

            assertEquals(100, portfolio.getAvailableQuantity());
        }

        @Test
        @DisplayName("getAvailableQuantity() khi lockedQuantity = quantity → trả về 0")
        void shouldReturnZeroWhenAllLocked() {
            Portfolio portfolio = Portfolio.builder()
                    .quantity(100)
                    .lockedQuantity(100)
                    .build();

            assertEquals(0, portfolio.getAvailableQuantity());
        }
    }
}

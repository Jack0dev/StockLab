package com.stocklab.engine;

import com.stocklab.model.*;
import com.stocklab.repository.OrderRepository;
import com.stocklab.repository.StockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

/**
 * TriggerEngine — Kiểm tra điều kiện kích hoạt cho lệnh điều kiện
 *
 * Input:  Giá thị trường realtime (stock.currentPrice)
 * Output: Chuyển order từ PENDING_TRIGGER → ACTIVE
 *
 * Separation of concerns:
 * - TriggerEngine: xử lý trigger condition
 * - MatchingEngine: xử lý khớp lệnh (chỉ ACTIVE orders)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TriggerEngine {

    private final OrderRepository orderRepository;
    private final StockRepository stockRepository;

    /**
     * Kiểm tra và kích hoạt tất cả lệnh điều kiện đang PENDING_TRIGGER
     */
    @Transactional
    public int checkTriggers() {
        List<Order> pendingOrders = orderRepository.findByStatus(OrderStatus.PENDING_TRIGGER);
        if (pendingOrders.isEmpty()) return 0;

        int triggeredCount = 0;

        for (Order order : pendingOrders) {
            // Kiểm tra GTD expired
            if (order.getExpiryDate() != null && LocalDateTime.now().isAfter(order.getExpiryDate())) {
                expireOrder(order);
                continue;
            }

            Stock stock = stockRepository.findById(order.getStock().getId()).orElse(null);
            if (stock == null) continue;

            BigDecimal currentPrice = stock.getCurrentPrice();
            if (currentPrice == null || currentPrice.compareTo(BigDecimal.ZERO) <= 0) continue;

            boolean triggered = switch (order.getOrderType()) {
                case STOP_MARKET -> checkStopTrigger(order, currentPrice);
                case STOP_LIMIT -> checkStopTrigger(order, currentPrice);
                case TAKE_PROFIT -> checkTakeProfitTrigger(order, currentPrice);
                case TAKE_PROFIT_LIMIT -> checkTakeProfitTrigger(order, currentPrice);
                case TRAILING_STOP -> checkTrailingStopTrigger(order, currentPrice);
                case TRAILING_STOP_LIMIT -> checkTrailingStopTrigger(order, currentPrice);
                default -> false;
            };

            if (triggered) {
                activateOrder(order, currentPrice);
                triggeredCount++;
            }
        }

        return triggeredCount;
    }

    // ===== Trigger Logic =====

    /**
     * STOP trigger:
     * - SELL: kích hoạt khi currentPrice <= stopPrice (giá giảm xuống dưới stop)
     * - BUY:  kích hoạt khi currentPrice >= stopPrice (giá tăng lên trên stop)
     */
    private boolean checkStopTrigger(Order order, BigDecimal currentPrice) {
        if (order.getStopPrice() == null) return false;

        if (order.getSide() == OrderSide.SELL) {
            return currentPrice.compareTo(order.getStopPrice()) <= 0;
        } else {
            return currentPrice.compareTo(order.getStopPrice()) >= 0;
        }
    }

    /**
     * TAKE_PROFIT trigger (ngược với STOP):
     * - SELL: kích hoạt khi currentPrice >= stopPrice (giá lên đủ target → chốt lời)
     * - BUY:  kích hoạt khi currentPrice <= stopPrice (giá giảm đủ → mua vào)
     */
    private boolean checkTakeProfitTrigger(Order order, BigDecimal currentPrice) {
        if (order.getStopPrice() == null) return false;

        if (order.getSide() == OrderSide.SELL) {
            return currentPrice.compareTo(order.getStopPrice()) >= 0;
        } else {
            return currentPrice.compareTo(order.getStopPrice()) <= 0;
        }
    }

    /**
     * TRAILING STOP trigger:
     * 1. Track đỉnh/đáy giá
     * 2. Khi giá quay đầu >= trailingDelta% → trigger
     *
     * SELL trailing: track highest → trigger khi giá giảm >= delta% từ đỉnh
     * BUY trailing:  track lowest  → trigger khi giá tăng >= delta% từ đáy
     */
    private boolean checkTrailingStopTrigger(Order order, BigDecimal currentPrice) {
        if (order.getTrailingDelta() == null) return false;

        // Kiểm tra activationPrice — chỉ bắt đầu track khi giá đạt ngưỡng
        if (order.getActivationPrice() != null) {
            if (order.getSide() == OrderSide.SELL
                    && currentPrice.compareTo(order.getActivationPrice()) < 0) {
                return false; // Chưa đạt activation price
            }
            if (order.getSide() == OrderSide.BUY
                    && currentPrice.compareTo(order.getActivationPrice()) > 0) {
                return false;
            }
        }

        if (order.getSide() == OrderSide.SELL) {
            // Track highest price
            BigDecimal highest = order.getHighestTrackedPrice();
            if (highest == null || currentPrice.compareTo(highest) > 0) {
                order.setHighestTrackedPrice(currentPrice);
                orderRepository.save(order);
                return false; // Giá vẫn đang lên, chưa trigger
            }

            // Kiểm tra giá giảm từ đỉnh >= delta%
            BigDecimal dropPercent = highest.subtract(currentPrice)
                    .divide(highest, 6, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));

            return dropPercent.compareTo(order.getTrailingDelta()) >= 0;

        } else { // BUY
            // Track lowest price
            BigDecimal lowest = order.getLowestTrackedPrice();
            if (lowest == null || currentPrice.compareTo(lowest) < 0) {
                order.setLowestTrackedPrice(currentPrice);
                orderRepository.save(order);
                return false; // Giá vẫn đang giảm, chưa trigger
            }

            // Kiểm tra giá tăng từ đáy >= delta%
            BigDecimal risePercent = currentPrice.subtract(lowest)
                    .divide(lowest, 6, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));

            return risePercent.compareTo(order.getTrailingDelta()) >= 0;
        }
    }

    // ===== State Transitions =====

    /**
     * Kích hoạt lệnh: PENDING_TRIGGER → ACTIVE
     */
    private void activateOrder(Order order, BigDecimal currentPrice) {
        order.setStatus(OrderStatus.ACTIVE);
        order.setTriggered(true);
        order.setTriggeredAt(LocalDateTime.now());

        // Nếu là MARKET-like, set price = currentPrice
        if (order.getOrderType().isMarketLike()) {
            order.setPrice(currentPrice);
        }
        // LIMIT-like giữ nguyên price đã set khi đặt lệnh

        // Áp dụng TimeInForce mặc định nếu chưa có
        if (order.getTimeInForce() == null) {
            order.setTimeInForce(order.getOrderType().isMarketLike()
                    ? TimeInForce.IOC : TimeInForce.GTC);
        }

        orderRepository.save(order);
        log.info("🔔 TRIGGERED {} #{} {} {} @ stopPrice={} → ACTIVE (price={})",
                order.getOrderType(), order.getId(),
                order.getSide(), order.getStock().getTicker(),
                order.getStopPrice(), order.getPrice());
    }

    /**
     * Hết hạn lệnh: PENDING_TRIGGER → EXPIRED
     */
    private void expireOrder(Order order) {
        order.setStatus(OrderStatus.EXPIRED);
        orderRepository.save(order);

        // TODO: unlock tài sản đã lock (nếu có)
        log.info("⏰ EXPIRED {} #{} {} {}",
                order.getOrderType(), order.getId(),
                order.getSide(), order.getStock().getTicker());
    }
}

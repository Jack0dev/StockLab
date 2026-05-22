package com.stocklab.engine;

import com.stocklab.model.*;
import com.stocklab.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Matching Engine — Khớp lệnh theo Price-Time Priority
 * - BUY giá cao nhất vs SELL giá thấp nhất
 * - Cùng giá → FIFO (lệnh đặt trước khớp trước)
 * - LIMIT: chỉ khớp khi buyPrice >= sellPrice
 * - MARKET: khớp ngay với giá đối ứng tốt nhất
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingEngine {

    private final OrderRepository orderRepository;

    /**
     * Khớp tất cả lệnh PENDING/PARTIAL cho 1 cổ phiếu
     */
    @Transactional
    public List<MatchResult> matchOrders(Stock stock) {
        List<MatchResult> results = new ArrayList<>();
        List<OrderStatus> activeStatuses = List.of(OrderStatus.ACTIVE, OrderStatus.PARTIALLY_FILLED);

        // 1. Lấy lệnh BUY: giá cao nhất trước, cùng giá → FIFO
        List<Order> buyOrders = new ArrayList<>(orderRepository
                .findByStockIdAndSideAndStatusInOrderByPriceDescCreatedAtAsc(
                        stock.getId(), OrderSide.BUY, activeStatuses));

        // 2. Lấy lệnh SELL: giá thấp nhất trước, cùng giá → FIFO
        List<Order> sellOrders = new ArrayList<>(orderRepository
                .findByStockIdAndSideAndStatusInOrderByPriceAscCreatedAtAsc(
                        stock.getId(), OrderSide.SELL, activeStatuses));

        // 3. Hủy lệnh MARKET không có đối ứng
        cancelUnmatchableMarketOrders(buyOrders, sellOrders);

        // 4. Khớp lệnh
        int buyIdx = 0;
        int sellIdx = 0;

        while (buyIdx < buyOrders.size() && sellIdx < sellOrders.size()) {
            Order buyOrder = buyOrders.get(buyIdx);
            Order sellOrder = sellOrders.get(sellIdx);

            // Bỏ qua lệnh đã xử lý xong
            if (buyOrder.getRemainingQuantity() <= 0) {
                buyIdx++;
                continue;
            }
            if (sellOrder.getRemainingQuantity() <= 0) {
                sellIdx++;
                continue;
            }

            // Xác định giá khớp
            BigDecimal matchPrice = determineMatchPrice(buyOrder, sellOrder);

            // Không khớp được (LIMIT BUY < LIMIT SELL)
            if (matchPrice == null) {
                break; // Vì đã sort, nên các cặp sau cũng không khớp
            }

            // [ANTI-WASH TRADING] Không cho phép tự khớp lệnh của cùng 1 user
            if (buyOrder.getUser().getId().equals(sellOrder.getUser().getId())) {
                log.warn("[WASH TRADE] Prevented self-matching for user {}: BUY #{} vs SELL #{}",
                        buyOrder.getUser().getId(), buyOrder.getId(), sellOrder.getId());
                
                // Bỏ qua cặp này, ưu tiên tăng index của lệnh đặt sau
                if (buyOrder.getCreatedAt().isAfter(sellOrder.getCreatedAt())) {
                    buyIdx++;
                } else {
                    sellIdx++;
                }
                continue;
            }

            // Tính số lượng khớp = min(remaining BUY, remaining SELL)
            int matchQty = Math.min(buyOrder.getRemainingQuantity(), sellOrder.getRemainingQuantity());

            // Cập nhật filled quantity
            buyOrder.setFilledQuantity(buyOrder.getFilledQuantity() + matchQty);
            sellOrder.setFilledQuantity(sellOrder.getFilledQuantity() + matchQty);

            // Cập nhật trạng thái
            updateOrderStatus(buyOrder);
            updateOrderStatus(sellOrder);

            // Lưu kết quả
            results.add(MatchResult.builder()
                    .buyOrder(buyOrder)
                    .sellOrder(sellOrder)
                    .matchPrice(matchPrice)
                    .matchQuantity(matchQty)
                    .build());

            log.info("[MATCH] {} {} x {} @ {} | BUY #{} ({}) vs SELL #{} ({})",
                    stock.getTicker(), matchQty, matchPrice,
                    matchQty,
                    buyOrder.getId(), buyOrder.getStatus(),
                    sellOrder.getId(), sellOrder.getStatus());

            // Di chuyển index nếu lệnh đã filled
            if (buyOrder.getRemainingQuantity() <= 0) buyIdx++;
            if (sellOrder.getRemainingQuantity() <= 0) sellIdx++;
        }

        // Lưu tất cả order đã thay đổi
        if (!results.isEmpty()) {
            saveChangedOrders(buyOrders, sellOrders);
        }

        return results;
    }

    /**
     * Xác định giá khớp:
     * - Nếu 1 bên là MARKET → dùng giá bên LIMIT (maker)
     * - Cả 2 LIMIT → dùng giá lệnh sell (lệnh sẵn trong sổ = maker)
     * - Cả 2 MARKET → dùng giá hiện tại (đã set khi đặt lệnh)
     */
    private BigDecimal determineMatchPrice(Order buyOrder, Order sellOrder) {
        boolean buyIsMarket = buyOrder.getOrderType().isMarketLike();
        boolean sellIsMarket = sellOrder.getOrderType().isMarketLike();

        if (buyIsMarket && sellIsMarket) {
            // Cả 2 MARKET → dùng giá hiện tại của stock
            return buyOrder.getPrice(); // đã set = currentPrice khi đặt lệnh
        }

        if (buyIsMarket) {
            // MARKET BUY khớp tại giá SELL (seller là maker)
            return sellOrder.getPrice();
        }

        if (sellIsMarket) {
            // MARKET SELL khớp tại giá BUY (buyer là maker)
            return buyOrder.getPrice();
        }

        // Cả 2 LIMIT: chỉ khớp khi buyPrice >= sellPrice
        if (buyOrder.getPrice().compareTo(sellOrder.getPrice()) >= 0) {
            // Giá khớp = giá lệnh sell (maker — lệnh có trước trong sổ lệnh)
            return sellOrder.getPrice();
        }

        return null; // Không khớp
    }

    /**
     * Cập nhật trạng thái Order dựa trên filled quantity
     */
    private void updateOrderStatus(Order order) {
        if (order.getFilledQuantity() >= order.getQuantity()) {
            order.setStatus(OrderStatus.FILLED);
        } else if (order.getFilledQuantity() > 0) {
            order.setStatus(OrderStatus.PARTIALLY_FILLED);
        }
    }

    /**
     * Hủy lệnh MARKET không có đối ứng
     */
    private void cancelUnmatchableMarketOrders(List<Order> buyOrders, List<Order> sellOrders) {
        // MARKET BUY không có SELL → CANCELLED
        if (sellOrders.isEmpty()) {
            buyOrders.stream()
                    .filter(o -> o.getOrderType().isMarketLike())
                    .forEach(o -> {
                        o.setStatus(OrderStatus.CANCELLED);
                        orderRepository.save(o);
                        log.info("[CANCEL] MARKET BUY #{} — no sell orders", o.getId());
                    });
            buyOrders.removeIf(o -> o.getStatus() == OrderStatus.CANCELLED);
        }

        // MARKET SELL không có BUY → CANCELLED
        if (buyOrders.isEmpty()) {
            sellOrders.stream()
                    .filter(o -> o.getOrderType().isMarketLike())
                    .forEach(o -> {
                        o.setStatus(OrderStatus.CANCELLED);
                        orderRepository.save(o);
                        log.info("[CANCEL] MARKET SELL #{} — no buy orders", o.getId());
                    });
            sellOrders.removeIf(o -> o.getStatus() == OrderStatus.CANCELLED);
        }
    }

    /**
     * Lưu tất cả order đã thay đổi status
     */
    private void saveChangedOrders(List<Order> buyOrders, List<Order> sellOrders) {
        buyOrders.stream()
                .filter(o -> o.getStatus() != OrderStatus.ACTIVE)
                .forEach(orderRepository::save);
        sellOrders.stream()
                .filter(o -> o.getStatus() != OrderStatus.ACTIVE)
                .forEach(orderRepository::save);
    }
}

package com.stocklab.service;

import com.stocklab.dto.OrderRequest;
import com.stocklab.model.OrderSide;
import com.stocklab.model.OrderType;
import com.stocklab.model.Stock;
import com.stocklab.repository.StockRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class TradingBotService {

    private final OrderService orderService;
    private final StockRepository stockRepository;
    private final WebSocketService webSocketService;
    private final Random random = new Random();

    private static final int BOT_COUNT = 20;
    private static final String BOT_PREFIX = "bot_";

    @Value("${app.bot.enabled:false}")
    @Getter
    private boolean botEnabled;

    public void setBotEnabled(boolean enabled) {
        this.botEnabled = enabled;
        broadcastStatus();
    }

    /**
     * Broadcast trạng thái bot qua WebSocket
     */
    private void broadcastStatus() {
        if (webSocketService != null) {
            webSocketService.broadcastBotStatus(
                    botEnabled,
                    totalOrdersPlaced.get(),
                    intervalMs,
                    getBotUsername(),
                    recentOrders.size()
            );
        }
    }

    @Value("${app.bot.interval-ms:5000}")
    @Getter
    private long intervalMs;

    // Lưu 100 lệnh gần nhất
    private final Deque<BotOrderLog> recentOrders = new ConcurrentLinkedDeque<>();
    private static final int MAX_LOG_SIZE = 100;
    private final AtomicLong totalOrdersPlaced = new AtomicLong(0);

    /**
     * Lấy tên bot ngẫu nhiên (bot_01 ~ bot_20)
     */
    private String randomBotName() {
        return String.format("%s%02d", BOT_PREFIX, random.nextInt(BOT_COUNT) + 1);
    }

    /**
     * Lấy 2 bot khác nhau để tạo cặp BUY-SELL
     */
    private String[] randomBotPair() {
        int a = random.nextInt(BOT_COUNT) + 1;
        int b;
        do { b = random.nextInt(BOT_COUNT) + 1; } while (b == a);
        return new String[]{
            String.format("%s%02d", BOT_PREFIX, a),
            String.format("%s%02d", BOT_PREFIX, b)
        };
    }

    /**
     * Mỗi 5 giây: 20 bot đặt lệnh trade với nhau
     * Tạo cặp BUY-SELL cùng giá gần nhau để đảm bảo khớp lệnh
     *
     * FIX: Sử dụng referencePrice làm neo thay vì currentPrice
     * để tránh hiện tượng cascading price crash (giá trôi 1 chiều).
     * Giá mục tiêu dao động ĐỐI XỨNG ±2% quanh referencePrice,
     * spread BUY/SELL rất nhỏ (0.1%) để giá khớp ≈ targetPrice.
     * Circuit breaker: giới hạn ±7% so với referencePrice.
     */
    @Scheduled(fixedDelayString = "${app.bot.interval-ms:5000}")
    public void runBotTask() {
        if (!botEnabled) return;

        try {
            List<Stock> stocks = stockRepository.findAll();
            if (stocks.isEmpty()) return;

            // Mỗi cycle: tạo 5 cặp giao dịch (10 lệnh) trên các CP khác nhau
            int pairsPerCycle = 5;
            for (int n = 0; n < pairsPerCycle; n++) {
                Stock stock = stocks.get(random.nextInt(stocks.size()));

                // Sử dụng referencePrice làm neo (tránh cascading crash)
                BigDecimal anchorPrice = stock.getReferencePrice();
                if (anchorPrice == null || anchorPrice.compareTo(BigDecimal.ZERO) <= 0) {
                    anchorPrice = stock.getCurrentPrice();
                }

                // Tạo cặp bot: 1 con BUY, 1 con SELL
                String[] pair = randomBotPair();
                String buyer = pair[0];
                String seller = pair[1];

                // Số lượng 10–200 CP
                int quantity = (random.nextInt(20) + 1) * 10;

                // Giá mục tiêu dao động ĐỐI XỨNG ±2% quanh anchorPrice
                double variation = (random.nextDouble() - 0.5) * 0.04; // -2% ~ +2%
                BigDecimal targetPrice = anchorPrice.multiply(BigDecimal.valueOf(1 + variation))
                        .setScale(0, RoundingMode.HALF_UP);

                // BUY cao hơn target 0.1%, SELL thấp hơn target 0.1% (spread nhỏ)
                BigDecimal buyPrice = targetPrice.multiply(BigDecimal.valueOf(1.001))
                        .setScale(0, RoundingMode.HALF_UP);
                BigDecimal sellPrice = targetPrice.multiply(BigDecimal.valueOf(0.999))
                        .setScale(0, RoundingMode.HALF_UP);

                // Đảm bảo buyPrice >= sellPrice để khớp được
                if (buyPrice.compareTo(sellPrice) < 0) {
                    BigDecimal temp = buyPrice;
                    buyPrice = sellPrice;
                    sellPrice = temp;
                }

                // Circuit breaker: giới hạn giá trong khoảng ±7% so với referencePrice
                BigDecimal maxPrice = anchorPrice.multiply(BigDecimal.valueOf(1.07))
                        .setScale(0, RoundingMode.HALF_UP);
                BigDecimal minPrice = anchorPrice.multiply(BigDecimal.valueOf(0.93))
                        .setScale(0, RoundingMode.HALF_UP);
                buyPrice = buyPrice.min(maxPrice).max(minPrice);
                sellPrice = sellPrice.min(maxPrice).max(minPrice);

                // === Đặt lệnh BUY ===
                OrderType buyType = random.nextDouble() < 0.2 ? OrderType.MARKET : OrderType.LIMIT;
                placeBotOrder(buyer, stock, OrderSide.BUY, quantity, buyPrice, buyType);

                // === Đặt lệnh SELL ===
                OrderType sellType = random.nextDouble() < 0.2 ? OrderType.MARKET : OrderType.LIMIT;
                placeBotOrder(seller, stock, OrderSide.SELL, quantity, sellPrice, sellType);
            }

            // Broadcast status sau mỗi cycle
            broadcastStatus();
        } catch (Exception e) {
            log.error("❌ Bot error: {}", e.getMessage());
        }
    }

    /**
     * Đặt 1 lệnh cho bot
     */
    private void placeBotOrder(String botName, Stock stock, OrderSide side, int quantity, BigDecimal price, OrderType orderType) {
        OrderRequest request = new OrderRequest();
        request.setTicker(stock.getTicker());
        request.setSide(side.name());
        request.setOrderType(orderType.name());
        request.setQuantity(quantity);
        if (orderType == OrderType.LIMIT) {
            request.setPrice(price);
        }
        // MARKET: không set price, OrderService sẽ dùng currentPrice

        orderService.placeOrder(botName, request);
        totalOrdersPlaced.incrementAndGet();

        // Log
        BotOrderLog entry = new BotOrderLog(
                stock.getTicker(), side.name(), quantity,
                price, LocalDateTime.now(), botName, orderType.name()
        );
        recentOrders.addFirst(entry);
        while (recentOrders.size() > MAX_LOG_SIZE) {
            recentOrders.removeLast();
        }

        log.info("🤖 {} {} {} {} CP {} @ {}", botName, orderType, side, quantity, stock.getTicker(), price);

        // Broadcast WebSocket
        if (webSocketService != null) {
            webSocketService.broadcastBotOrder(stock.getTicker(), side.name(), quantity, price);
        }
    }

    public List<BotOrderLog> getRecentOrders() {
        return new ArrayList<>(recentOrders);
    }

    public long getTotalOrdersPlaced() {
        return totalOrdersPlaced.get();
    }

    public String getBotUsername() {
        return "bot_01"; // backward compat for API
    }

    // DTO cho log activity
    public record BotOrderLog(
            String ticker,
            String side,
            int quantity,
            BigDecimal price,
            LocalDateTime timestamp,
            String botName,
            String orderType
    ) {}
}

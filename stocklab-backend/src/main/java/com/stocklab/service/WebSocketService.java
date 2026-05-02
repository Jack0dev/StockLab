package com.stocklab.service;

import com.stocklab.model.Stock;
import com.stocklab.repository.StockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;
    private final StockRepository stockRepository;

    /**
     * 🔥 Broadcast giá cổ phiếu mỗi 3 giây → /topic/prices
     * Frontend sẽ subscribe topic này để cập nhật bảng giá real-time
     */
    @Scheduled(fixedRate = 3000)
    public void broadcastStockPrices() {
        try {
            List<Stock> stocks = stockRepository.findAll();
            List<Map<String, Object>> payload = stocks.stream().map(s -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("ticker", s.getTicker());
                item.put("currentPrice", s.getCurrentPrice());
                item.put("referencePrice", s.getReferencePrice());
                item.put("openPrice", s.getOpenPrice());
                item.put("highPrice", s.getHighPrice());
                item.put("lowPrice", s.getLowPrice());
                item.put("volume", s.getVolume());
                item.put("change", s.getChange());
                item.put("changePercent", s.getChangePercent());
                return item;
            }).toList();

            messagingTemplate.convertAndSend("/topic/prices", payload);
        } catch (Exception e) {
            log.error("❌ WebSocket broadcast prices error: {}", e.getMessage());
        }
    }

    /**
     * 📡 Broadcast sự kiện giao dịch (khớp lệnh) → /topic/trades
     */
    public void broadcastTrade(String ticker, String side, int quantity, BigDecimal price) {
        try {
            Map<String, Object> trade = new LinkedHashMap<>();
            trade.put("ticker", ticker);
            trade.put("side", side);
            trade.put("quantity", quantity);
            trade.put("price", price);
            trade.put("timestamp", LocalDateTime.now().toString());

            messagingTemplate.convertAndSend("/topic/trades", trade);
            log.debug("📡 WS broadcast trade: {} {} {} @ {}", side, quantity, ticker, price);
        } catch (Exception e) {
            log.error("❌ WebSocket broadcast trade error: {}", e.getMessage());
        }
    }

    /**
     * 🤖 Broadcast lệnh bot → /topic/bot
     */
    public void broadcastBotOrder(String ticker, String side, int quantity, BigDecimal price) {
        try {
            Map<String, Object> botOrder = new LinkedHashMap<>();
            botOrder.put("ticker", ticker);
            botOrder.put("side", side);
            botOrder.put("quantity", quantity);
            botOrder.put("price", price);
            botOrder.put("timestamp", LocalDateTime.now().toString());
            botOrder.put("status", "SUCCESS");

            messagingTemplate.convertAndSend("/topic/bot", botOrder);
        } catch (Exception e) {
            log.error("❌ WebSocket broadcast bot error: {}", e.getMessage());
        }
    }

    /**
     * 📊 Broadcast trạng thái bot → /topic/bot-status
     */
    public void broadcastBotStatus(boolean enabled, long totalOrdersPlaced, long intervalMs, String username, int recentOrderCount) {
        try {
            Map<String, Object> status = new LinkedHashMap<>();
            status.put("enabled", enabled);
            status.put("totalOrdersPlaced", totalOrdersPlaced);
            status.put("intervalMs", intervalMs);
            status.put("username", username);
            status.put("recentOrderCount", recentOrderCount);

            messagingTemplate.convertAndSend("/topic/bot-status", status);
        } catch (Exception e) {
            log.error("❌ WebSocket broadcast bot-status error: {}", e.getMessage());
        }
    }
}

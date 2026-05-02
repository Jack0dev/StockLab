package com.stocklab.controller;

import com.stocklab.service.TradingBotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/bot")
@RequiredArgsConstructor
public class BotController {

    private final TradingBotService tradingBotService;

    /**
     * GET /api/bot/status — Trạng thái bot
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getBotStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("enabled", tradingBotService.isBotEnabled());
        status.put("username", tradingBotService.getBotUsername());
        status.put("intervalMs", tradingBotService.getIntervalMs());
        status.put("totalOrdersPlaced", tradingBotService.getTotalOrdersPlaced());
        status.put("recentOrderCount", tradingBotService.getRecentOrders().size());
        return ResponseEntity.ok(status);
    }

    /**
     * GET /api/bot/activity — 50 lệnh gần nhất
     */
    @GetMapping("/activity")
    public ResponseEntity<?> getBotActivity() {
        return ResponseEntity.ok(tradingBotService.getRecentOrders());
    }

    /**
     * PUT /api/bot/toggle — Bật/tắt bot
     */
    @PutMapping("/toggle")
    public ResponseEntity<Map<String, Object>> toggleBot() {
        boolean newState = !tradingBotService.isBotEnabled();
        tradingBotService.setBotEnabled(newState);
        
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("enabled", newState);
        return ResponseEntity.ok(response);
    }
}

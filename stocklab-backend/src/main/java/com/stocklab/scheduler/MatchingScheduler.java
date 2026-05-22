package com.stocklab.scheduler;

import com.stocklab.engine.MatchResult;
import com.stocklab.engine.MatchingEngine;
import com.stocklab.engine.PostTradeProcessor;
import com.stocklab.model.OrderStatus;
import com.stocklab.model.Stock;
import com.stocklab.repository.OrderRepository;
import com.stocklab.repository.StockRepository;
import com.stocklab.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Matching Scheduler — chạy mỗi 1 giây
 * Tìm tất cả cổ phiếu có lệnh PENDING/PARTIAL, khớp lệnh cho từng CP
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingScheduler {

    private final MatchingEngine matchingEngine;
    private final PostTradeProcessor postTradeProcessor;
    private final OrderRepository orderRepository;
    private final StockRepository stockRepository;
    private final WebSocketService webSocketService;

    /**
     * Chạy mỗi 1 giây — khớp lệnh cho tất cả CP có lệnh active
     */
    @Scheduled(fixedRate = 1000)
    public void runMatchingCycle() {
        List<OrderStatus> activeStatuses = List.of(OrderStatus.ACTIVE, OrderStatus.PARTIALLY_FILLED);

        // 1. Tìm tất cả stock có lệnh active
        List<Long> stockIds = orderRepository.findDistinctStockIdsByStatusIn(activeStatuses);

        if (stockIds.isEmpty()) {
            return; // Không có lệnh nào → skip
        }

        // 2. Khớp lệnh cho từng stock
        for (Long stockId : stockIds) {
            Stock stock = stockRepository.findById(stockId).orElse(null);
            if (stock == null) continue;

            try {
                // Chạy matching engine
                List<MatchResult> results = matchingEngine.matchOrders(stock);

                // Xử lý hậu khớp cho từng match
                for (MatchResult result : results) {
                    postTradeProcessor.process(result);

                    // 🔥 Broadcast trade event qua WebSocket
                    webSocketService.broadcastTrade(
                        stock.getTicker(),
                        "MATCHED",
                        result.getMatchQuantity(),
                        result.getMatchPrice()
                    );
                }

                if (!results.isEmpty()) {
                    log.info("[SCHEDULER] {} — khớp {} lệnh", stock.getTicker(), results.size());
                }
            } catch (Exception e) {
                log.error("[SCHEDULER] Lỗi khớp lệnh cho {}: {}", stock.getTicker(), e.getMessage(), e);
            }
        }
    }
}

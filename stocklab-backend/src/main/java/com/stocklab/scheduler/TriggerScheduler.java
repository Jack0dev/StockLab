package com.stocklab.scheduler;

import com.stocklab.engine.TriggerEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * TriggerScheduler — chạy mỗi 1 giây
 * Kiểm tra điều kiện kích hoạt cho tất cả lệnh PENDING_TRIGGER
 *
 * Pipeline:
 * TriggerScheduler (1s) → TriggerEngine.checkTriggers()
 * MatchingScheduler (1s) → MatchingEngine.matchOrders() [chỉ ACTIVE]
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TriggerScheduler {

    private final TriggerEngine triggerEngine;

    @Scheduled(fixedRate = 1000)
    public void runTriggerCycle() {
        try {
            int triggered = triggerEngine.checkTriggers();
            if (triggered > 0) {
                log.info("[TRIGGER-SCHEDULER] Kích hoạt {} lệnh điều kiện", triggered);
            }
        } catch (Exception e) {
            log.error("[TRIGGER-SCHEDULER] Lỗi: {}", e.getMessage(), e);
        }
    }
}

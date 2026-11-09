package com.stocklab.service.bot.manipulation.model;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

@Getter
@Setter
@Builder
public class CampaignContext {

    private String campaignId;
    private ScenarioType scenarioType;
    private List<String> tickers;
    private ManipulationIntensity intensity;
    private int durationMinutes;
    private Double customTargetPercent; // override % mục tiêu nếu có
    private String customMode; // e.g. "LOCK_CEILING" or "LOCK_FLOOR" for LOCK_LIMIT

    @Builder.Default
    private CampaignStatus status = CampaignStatus.RUNNING;

    private String currentPhase;
    private int currentPhaseIndex;

    private LocalDateTime startTime;
    private LocalDateTime phaseStartTime;
    private LocalDateTime lastTickTime;

    @Builder.Default
    private Map<String, BigDecimal> startingPrices = new ConcurrentHashMap<>();

    @Builder.Default
    private Map<String, BigDecimal> targetPrices = new ConcurrentHashMap<>();

    @Builder.Default
    private AtomicLong totalOrdersPlaced = new AtomicLong(0);

    @Builder.Default
    private AtomicLong totalVolumeTraded = new AtomicLong(0);

    @Builder.Default
    private Deque<String> recentLogs = new ConcurrentLinkedDeque<>();

    public long getElapsedSeconds() {
        if (startTime == null) return 0;
        return Duration.between(startTime, LocalDateTime.now()).getSeconds();
    }

    public long getTotalSeconds() {
        return (long) durationMinutes * 60;
    }

    public double getProgressPercent() {
        long total = getTotalSeconds();
        if (total <= 0) return 100.0;
        long elapsed = getElapsedSeconds();
        double pct = ((double) elapsed / total) * 100.0;
        return Math.min(100.0, Math.max(0.0, Math.round(pct * 10.0) / 10.0));
    }

    public void logEvent(String message) {
        String logEntry = String.format("[%s] %s", LocalDateTime.now().toLocalTime().toString().substring(0, 8), message);
        recentLogs.addFirst(logEntry);
        while (recentLogs.size() > 50) {
            recentLogs.removeLast();
        }
    }

    public List<String> getLogsList() {
        return new ArrayList<>(recentLogs);
    }
}

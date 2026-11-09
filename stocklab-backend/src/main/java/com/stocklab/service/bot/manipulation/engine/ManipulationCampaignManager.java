package com.stocklab.service.bot.manipulation.engine;

import com.stocklab.domain.model.OrderStatus;
import com.stocklab.infrastructure.repository.OrderRepository;
import com.stocklab.service.OrderService;
import com.stocklab.service.WebSocketService;
import com.stocklab.service.bot.manipulation.model.CampaignContext;
import com.stocklab.service.bot.manipulation.model.CampaignStatus;
import com.stocklab.service.bot.manipulation.model.ManipulationIntensity;
import com.stocklab.service.bot.manipulation.model.ScenarioType;
import com.stocklab.service.bot.manipulation.strategy.ManipulationStrategy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class ManipulationCampaignManager {

    private final Map<ScenarioType, ManipulationStrategy> strategyMap = new EnumMap<>(ScenarioType.class);
    private final Map<String, CampaignContext> activeCampaigns = new ConcurrentHashMap<>();

    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final BotFundManager botFundManager;
    private final WebSocketService webSocketService;

    public ManipulationCampaignManager(List<ManipulationStrategy> strategies,
                                       OrderRepository orderRepository,
                                       OrderService orderService,
                                       BotFundManager botFundManager,
                                       WebSocketService webSocketService) {
        this.orderRepository = orderRepository;
        this.orderService = orderService;
        this.botFundManager = botFundManager;
        this.webSocketService = webSocketService;

        for (ManipulationStrategy s : strategies) {
            strategyMap.put(s.getScenarioType(), s);
        }
    }

    /**
     * Khởi chạy một chiến dịch thao túng giá
     */
    public synchronized CampaignContext startCampaign(ScenarioType scenarioType,
                                                      List<String> tickers,
                                                      int durationMinutes,
                                                      ManipulationIntensity intensity,
                                                      Double customTargetPercent,
                                                      String customMode) {
        if (scenarioType == null || tickers == null || tickers.isEmpty()) {
            throw new IllegalArgumentException("Kịch bản và danh sách mã cổ phiếu không được để trống");
        }

        String campaignId = "camp_" + UUID.randomUUID().toString().substring(0, 8);
        int cleanDuration = durationMinutes > 0 ? durationMinutes : scenarioType.getDefaultDurationMinutes();
        ManipulationIntensity cleanIntensity = intensity != null ? intensity : ManipulationIntensity.MEDIUM;

        CampaignContext ctx = CampaignContext.builder()
                .campaignId(campaignId)
                .scenarioType(scenarioType)
                .tickers(new ArrayList<>(tickers))
                .durationMinutes(cleanDuration)
                .intensity(cleanIntensity)
                .customTargetPercent(customTargetPercent)
                .customMode(customMode)
                .status(CampaignStatus.RUNNING)
                .startTime(LocalDateTime.now())
                .phaseStartTime(LocalDateTime.now())
                .lastTickTime(LocalDateTime.now())
                .build();

        ManipulationStrategy strategy = strategyMap.get(scenarioType);
        if (strategy != null) {
            strategy.onCampaignStart(ctx);
        }

        activeCampaigns.put(campaignId, ctx);
        log.info("Started manipulation campaign {}: {} on {}", campaignId, scenarioType, tickers);

        broadcastCampaignUpdate(ctx);
        return ctx;
    }

    /**
     * Dừng 1 chiến dịch cụ thể
     */
    public synchronized boolean stopCampaign(String campaignId) {
        CampaignContext ctx = activeCampaigns.get(campaignId);
        if (ctx == null) return false;

        ctx.setStatus(CampaignStatus.STOPPED);
        ManipulationStrategy strategy = strategyMap.get(ctx.getScenarioType());
        if (strategy != null) {
            strategy.onCampaignStop(ctx);
        }
        activeCampaigns.remove(campaignId);
        log.info("Stopped manipulation campaign {}", campaignId);

        broadcastCampaignUpdate(ctx);
        return true;
    }

    /**
     * Dừng khẩn cấp toàn bộ (Emergency Kill-Switch):
     * 1. Hủy toàn bộ chiến dịch đang chạy
     * 2. Quét và hủy toàn bộ các lệnh PENDING/PARTIAL của 20 bot trên sàn
     */
    public synchronized int emergencyKillSwitch() {
        log.warn("EMERGENCY KILL-SWITCH TRIGGERED BY ADMIN!");

        // 1. Dừng mọi campaign
        for (CampaignContext ctx : activeCampaigns.values()) {
            ctx.setStatus(CampaignStatus.STOPPED);
            ManipulationStrategy strategy = strategyMap.get(ctx.getScenarioType());
            if (strategy != null) {
                strategy.onCampaignStop(ctx);
            }
            broadcastCampaignUpdate(ctx);
        }
        activeCampaigns.clear();

        // 2. Hủy các lệnh đang treo của 20 bot
        List<String> botUsernames = botFundManager.getAllBotUsernames();
        List<OrderStatus> pendingStatuses = List.of(OrderStatus.ACTIVE, OrderStatus.PARTIALLY_FILLED);
        var pendingBotOrders = orderRepository.findBotPendingOrders(botUsernames, pendingStatuses);

        int canceledCount = 0;
        for (var order : pendingBotOrders) {
            try {
                orderService.forceCancelOrder(order.getId());
                canceledCount++;
            } catch (Exception e) {
                log.error("Failed to cancel bot order {}: {}", order.getId(), e.getMessage());
            }
        }
        log.info("Kill-switch completed: canceled {} pending bot orders.", canceledCount);
        return canceledCount;
    }

    /**
     * Vòng lặp tick được gọi bởi Scheduler định kỳ
     */
    public void tickActiveCampaigns() {
        if (activeCampaigns.isEmpty()) return;

        for (CampaignContext ctx : new ArrayList<>(activeCampaigns.values())) {
            if (ctx.getStatus() != CampaignStatus.RUNNING) continue;

            // Kiểm tra hết thời gian chiến dịch
            if (ctx.getElapsedSeconds() >= ctx.getTotalSeconds()) {
                ctx.setStatus(CampaignStatus.COMPLETED);
                ManipulationStrategy strategy = strategyMap.get(ctx.getScenarioType());
                if (strategy != null) {
                    strategy.onCampaignStop(ctx);
                }
                activeCampaigns.remove(ctx.getCampaignId());
                log.info("Campaign {} reached target duration and completed.", ctx.getCampaignId());
                broadcastCampaignUpdate(ctx);
                continue;
            }

            // Thực thi bước kế tiếp của strategy
            ManipulationStrategy strategy = strategyMap.get(ctx.getScenarioType());
            if (strategy != null) {
                try {
                    strategy.executeStep(ctx);
                    ctx.setLastTickTime(LocalDateTime.now());
                } catch (Exception e) {
                    log.error("Error ticking campaign {}: {}", ctx.getCampaignId(), e.getMessage());
                }
            }
            broadcastCampaignUpdate(ctx);
        }
    }

    public List<CampaignContext> getActiveCampaigns() {
        return new ArrayList<>(activeCampaigns.values());
    }

    public Optional<CampaignContext> getCampaign(String id) {
        return Optional.ofNullable(activeCampaigns.get(id));
    }

    private void broadcastCampaignUpdate(CampaignContext ctx) {
        if (webSocketService != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("campaignId", ctx.getCampaignId());
            payload.put("scenarioType", ctx.getScenarioType().name());
            payload.put("scenarioTitle", ctx.getScenarioType().getTitleVi());
            payload.put("tickers", ctx.getTickers());
            payload.put("status", ctx.getStatus().name());
            payload.put("currentPhase", ctx.getCurrentPhase());
            payload.put("currentPhaseIndex", ctx.getCurrentPhaseIndex());
            payload.put("progressPercent", ctx.getProgressPercent());
            payload.put("elapsedSeconds", ctx.getElapsedSeconds());
            payload.put("totalSeconds", ctx.getTotalSeconds());
            payload.put("ordersPlaced", ctx.getTotalOrdersPlaced().get());
            payload.put("volumeTraded", ctx.getTotalVolumeTraded().get());
            payload.put("recentLogs", ctx.getLogsList());

            webSocketService.broadcastToTopic("/topic/admin/manipulation", payload);
        }
    }
}

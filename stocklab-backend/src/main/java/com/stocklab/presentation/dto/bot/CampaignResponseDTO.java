package com.stocklab.presentation.dto.bot;

import com.stocklab.service.bot.manipulation.model.CampaignContext;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CampaignResponseDTO {

    private String campaignId;
    private String scenarioType;
    private String scenarioTitle;
    private List<String> tickers;
    private int durationMinutes;
    private String intensity;
    private String status;
    private String currentPhase;
    private int currentPhaseIndex;
    private double progressPercent;
    private long elapsedSeconds;
    private long totalSeconds;
    private long ordersPlaced;
    private long volumeTraded;
    private List<String> logs;

    public static CampaignResponseDTO fromContext(CampaignContext ctx) {
        if (ctx == null) return null;
        return CampaignResponseDTO.builder()
                .campaignId(ctx.getCampaignId())
                .scenarioType(ctx.getScenarioType().name())
                .scenarioTitle(ctx.getScenarioType().getTitleVi())
                .tickers(ctx.getTickers())
                .durationMinutes(ctx.getDurationMinutes())
                .intensity(ctx.getIntensity() != null ? ctx.getIntensity().name() : "MEDIUM")
                .status(ctx.getStatus().name())
                .currentPhase(ctx.getCurrentPhase())
                .currentPhaseIndex(ctx.getCurrentPhaseIndex())
                .progressPercent(ctx.getProgressPercent())
                .elapsedSeconds(ctx.getElapsedSeconds())
                .totalSeconds(ctx.getTotalSeconds())
                .ordersPlaced(ctx.getTotalOrdersPlaced().get())
                .volumeTraded(ctx.getTotalVolumeTraded().get())
                .logs(ctx.getLogsList())
                .build();
    }
}

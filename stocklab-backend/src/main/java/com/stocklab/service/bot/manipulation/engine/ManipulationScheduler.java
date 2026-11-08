package com.stocklab.service.bot.manipulation.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ManipulationScheduler {

    private final ManipulationCampaignManager campaignManager;

    /**
     * Vòng lặp quét chu kỳ 2 giây cho các chiến dịch thao túng đang hoạt động
     */
    @Scheduled(fixedDelay = 2000)
    public void runManipulationTick() {
        try {
            campaignManager.tickActiveCampaigns();
        } catch (Exception e) {
            log.error("Error in manipulation scheduler tick: {}", e.getMessage());
        }
    }
}

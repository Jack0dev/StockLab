package com.stocklab.service.bot.manipulation.strategy;

import com.stocklab.service.bot.manipulation.model.CampaignContext;
import com.stocklab.service.bot.manipulation.model.ScenarioType;

public interface ManipulationStrategy {

    ScenarioType getScenarioType();

    void onCampaignStart(CampaignContext context);

    void executeStep(CampaignContext context);

    void onCampaignStop(CampaignContext context);
}

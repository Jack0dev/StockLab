package com.stocklab.presentation.dto.bot;

import com.stocklab.service.bot.manipulation.model.ManipulationIntensity;
import com.stocklab.service.bot.manipulation.model.ScenarioType;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class StartCampaignRequest {

    @NotNull(message = "Loại kịch bản không được để trống")
    private ScenarioType scenarioType;

    @NotEmpty(message = "Danh sách mã cổ phiếu không được để trống")
    private List<String> tickers;

    private Integer durationMinutes;

    private ManipulationIntensity intensity = ManipulationIntensity.MEDIUM;

    private Double targetPercent;

    private String customMode; // e.g. "LOCK_CEILING" or "LOCK_FLOOR"
}

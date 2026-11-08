package com.stocklab.presentation.dto.bot;

import com.stocklab.service.bot.manipulation.model.ScenarioType;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ScenarioPresetDTO {

    private String type;
    private String titleVi;
    private String description;
    private int defaultDurationMinutes;
    private List<String> phases;

    public static ScenarioPresetDTO fromEnum(ScenarioType type) {
        return ScenarioPresetDTO.builder()
                .type(type.name())
                .titleVi(type.getTitleVi())
                .description(type.getDescription())
                .defaultDurationMinutes(type.getDefaultDurationMinutes())
                .phases(type.getPhases())
                .build();
    }
}

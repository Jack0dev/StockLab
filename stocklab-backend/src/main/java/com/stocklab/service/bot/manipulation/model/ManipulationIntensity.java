package com.stocklab.service.bot.manipulation.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ManipulationIntensity {

    LOW("Dịu nhẹ (Low)", 0.5, 3000L),
    MEDIUM("Tiêu chuẩn (Medium)", 1.0, 2000L),
    HIGH("Mạnh mẽ (High)", 1.8, 1500L),
    AGGRESSIVE("Quyết liệt (Aggressive)", 2.5, 1200L);

    private final String label;
    private final double volumeMultiplier;
    private final long tickIntervalMs;

    @JsonCreator
    public static ManipulationIntensity fromString(String value) {
        if (value == null) return MEDIUM;
        String val = value.trim().toUpperCase();
        for (ManipulationIntensity intensity : values()) {
            if (intensity.name().equalsIgnoreCase(val)) {
                return intensity;
            }
        }
        return MEDIUM;
    }
}

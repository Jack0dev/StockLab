package com.stocklab.service.bot.manipulation.model;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ManipulationIntensity {

    LOW("Dịu nhẹ (Low)", 0.5, 3000L),
    MEDIUM("Tiêu chuẩn (Medium)", 1.0, 2000L),
    AGGRESSIVE("Quyết liệt (Aggressive)", 2.5, 1200L);

    private final String label;
    private final double volumeMultiplier;
    private final long tickIntervalMs;
}

package com.stocklab.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnicalIndicatorsResponse {
    private String ticker;

    // RSI
    private Double rsi14;

    // MACD
    private Double macdLine;
    private Double signalLine;
    private Double histogram;

    // Moving Averages
    private BigDecimal sma20;
    private BigDecimal sma50;
    private BigDecimal ema12;
    private BigDecimal ema26;

    // Bollinger Bands
    private BigDecimal bollingerUpper;
    private BigDecimal bollingerMiddle;
    private BigDecimal bollingerLower;

    // Volume
    private Long avgVolume20;
    private Long currentVolume;
    private Double volumeRatio; // current / avg

    // Price info
    private BigDecimal currentPrice;
    private BigDecimal weekHigh52;
    private BigDecimal weekLow52;
}

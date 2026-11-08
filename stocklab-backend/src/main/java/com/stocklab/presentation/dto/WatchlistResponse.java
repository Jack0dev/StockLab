package com.stocklab.presentation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WatchlistResponse {

    private Long id;
    private String ticker;
    private String companyName;
    private String exchange;
    private BigDecimal currentPrice;
    private BigDecimal change;
    private Double changePercent;
    private LocalDateTime addedAt;
}

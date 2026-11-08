package com.stocklab.presentation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderEstimateRequest {

    private String ticker;
    private String side; // BUY or SELL
    private String orderType; // LO, MP, ATO, ATC, etc.
    private Integer quantity;
    private BigDecimal price;
    private BigDecimal stopPrice;
}

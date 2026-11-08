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
public class OrderEstimateResponse {

    private String ticker;
    private String companyName;
    private String side;
    private String orderType;
    private Integer quantity;
    private BigDecimal price;
    private BigDecimal effectivePrice;
    private BigDecimal grossAmount;
    private BigDecimal feeRate;
    private BigDecimal feeAmount;
    private BigDecimal totalAmount;
    private BigDecimal availableCash;
    private Integer availableHoldings;
    private Integer maxAffordableQuantity;
    private BigDecimal ceilingPrice;
    private BigDecimal floorPrice;
    private BigDecimal referencePrice;
    private boolean valid;
    private String validationCode;
    private String validationMessage;
}

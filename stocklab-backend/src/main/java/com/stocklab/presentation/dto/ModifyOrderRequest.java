package com.stocklab.presentation.dto;

import lombok.Data;

@Data
public class ModifyOrderRequest {
    private Integer quantity;
    private Double price;
}

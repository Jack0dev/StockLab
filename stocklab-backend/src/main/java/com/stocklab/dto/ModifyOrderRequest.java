package com.stocklab.dto;

import lombok.Data;

@Data
public class ModifyOrderRequest {
    private Integer quantity;
    private Double price;
}

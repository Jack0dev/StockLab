package com.stocklab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateStockRequest {
    @NotBlank(message = "Mã cổ phiếu không được để trống")
    private String ticker;

    @NotBlank(message = "Tên công ty không được để trống")
    private String companyName;

    private String exchange;

    @NotNull(message = "Giá cơ sở không được để trống")
    private BigDecimal basePrice;
}

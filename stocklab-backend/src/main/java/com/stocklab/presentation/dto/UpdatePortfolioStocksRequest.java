package com.stocklab.presentation.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UpdatePortfolioStocksRequest {

    @NotNull(message = "Danh sách mã cổ phiếu không được null")
    private List<String> tickers;
}

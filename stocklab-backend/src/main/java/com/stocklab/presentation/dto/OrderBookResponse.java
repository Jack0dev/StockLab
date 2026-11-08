package com.stocklab.presentation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrderBookResponse {

    private String ticker;
    private String companyName;
    private List<OrderBookEntry> bids; // Bên mua (giá giảm dần)
    private List<OrderBookEntry> asks; // Bên bán (giá tăng dần)

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class OrderBookEntry {
        private BigDecimal price;       // Mức giá
        private Integer totalQuantity;  // Tổng KL ở mức giá này
        private Integer orderCount;     // Số lượng lệnh ở mức giá này
    }
}

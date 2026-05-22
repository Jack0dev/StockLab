package com.stocklab.engine;

import com.stocklab.model.Order;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Kết quả 1 lần khớp lệnh giữa BUY và SELL
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchResult {

    private Order buyOrder;
    private Order sellOrder;
    private BigDecimal matchPrice;
    private int matchQuantity;

    @Builder.Default
    private LocalDateTime matchedAt = LocalDateTime.now();
}

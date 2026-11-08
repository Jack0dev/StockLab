package com.stocklab.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "stock_price_history", indexes = {
        @Index(name = "idx_stock_date", columnList = "stock_id, tradingDate")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockPriceHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_id", nullable = false)
    private Stock stock;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal openPrice;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal highPrice;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal lowPrice;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal closePrice;

    @Builder.Default
    private Long volume = 0L;

    @Column(nullable = false)
    private LocalDate tradingDate;
}

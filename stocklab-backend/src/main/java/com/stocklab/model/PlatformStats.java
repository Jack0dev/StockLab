package com.stocklab.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Thống kê nền tảng: theo dõi phí giao dịch, khối lượng,
 * và giá token SLP (StockLab Platform Token).
 */
@Entity
@Table(name = "platform_stats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlatformStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Tổng phí giao dịch đã thu (tích lũy từ đầu) */
    @Column(precision = 20, scale = 2)
    @Builder.Default
    private BigDecimal totalFeesCollected = BigDecimal.ZERO;

    /** Phí thu được trong ngày */
    @Column(precision = 20, scale = 2)
    @Builder.Default
    private BigDecimal dailyFees = BigDecimal.ZERO;

    /** Tổng số giao dịch đã khớp */
    @Builder.Default
    private Long totalTradesCount = 0L;

    /** Tổng khối lượng giao dịch (VND) */
    @Column(precision = 20, scale = 2)
    @Builder.Default
    private BigDecimal totalTradingVolume = BigDecimal.ZERO;

    /** Giá ban đầu của token SLP */
    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal tokenBasePrice = new BigDecimal("10000");

    /** Giá hiện tại của token SLP */
    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal tokenCurrentPrice = new BigDecimal("10000");

    /** Tổng supply token SLP */
    @Builder.Default
    private Long tokenTotalSupply = 1_000_000L;

    /** Ngày reset daily stats gần nhất */
    private LocalDate lastResetDate;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

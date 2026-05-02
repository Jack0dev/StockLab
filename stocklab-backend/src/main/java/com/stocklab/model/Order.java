package com.stocklab.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_order_user", columnList = "user_id"),
        @Index(name = "idx_order_stock_status", columnList = "stock_id, status"),
        @Index(name = "idx_order_stock_side_status", columnList = "stock_id, side, status"),
        @Index(name = "idx_order_oco_group", columnList = "oco_group_id"),
        @Index(name = "idx_order_status_type", columnList = "status, order_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_id", nullable = false)
    private Stock stock;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private OrderSide side; // BUY hoặc SELL

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private OrderType orderType;

    @Column(nullable = false)
    private Integer quantity; // Số lượng đặt

    @Column(nullable = false)
    @Builder.Default
    private Integer filledQuantity = 0; // Số lượng đã khớp

    @Column(precision = 15, scale = 2)
    private BigDecimal price; // Giá đặt (bắt buộc cho LIMIT-like, = currentPrice cho MARKET)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OrderStatus status = OrderStatus.ACTIVE;

    // === TimeInForce ===
    @Enumerated(EnumType.STRING)
    @Column(length = 5)
    @Builder.Default
    private TimeInForce timeInForce = TimeInForce.GTC;

    // === Conditional Order Fields ===

    /** Giá kích hoạt cho STOP_*, TAKE_PROFIT_* */
    @Column(precision = 15, scale = 2)
    private BigDecimal stopPrice;

    /** Khoảng trailing (%) cho TRAILING_* */
    @Column(precision = 10, scale = 4)
    private BigDecimal trailingDelta;

    /** Giá bắt đầu track trailing (optional) */
    @Column(precision = 15, scale = 2)
    private BigDecimal activationPrice;

    /** Đỉnh giá track realtime — cho TRAILING SELL */
    @Column(precision = 15, scale = 2)
    private BigDecimal highestTrackedPrice;

    /** Đáy giá track realtime — cho TRAILING BUY */
    @Column(precision = 15, scale = 2)
    private BigDecimal lowestTrackedPrice;

    // === OCO ===

    /** UUID nhóm OCO — shared giữa 2 orders */
    @Column(length = 36)
    private String ocoGroupId;

    // === Trigger tracking ===

    /** Lệnh điều kiện đã được kích hoạt chưa */
    @Column
    @Builder.Default
    private Boolean triggered = false;

    /** Thời điểm kích hoạt */
    @Column
    private LocalDateTime triggeredAt;

    /** Ngày hết hạn cho GTD */
    @Column
    private LocalDateTime expiryDate;

    // === Timestamps ===

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // === Helper Methods ===

    /**
     * Số lượng còn lại chưa khớp
     */
    public int getRemainingQuantity() {
        return quantity - filledQuantity;
    }

    /**
     * Kiểm tra lệnh có thể hủy không (ACTIVE, PARTIALLY_FILLED, hoặc PENDING_TRIGGER)
     */
    public boolean isCancellable() {
        return status == OrderStatus.ACTIVE
                || status == OrderStatus.PARTIALLY_FILLED
                || status == OrderStatus.PENDING_TRIGGER;
    }

    /**
     * Lệnh sẵn sàng cho MatchingEngine (đã vào sổ lệnh)
     */
    public boolean isReadyForMatching() {
        return status == OrderStatus.ACTIVE || status == OrderStatus.PARTIALLY_FILLED;
    }
}

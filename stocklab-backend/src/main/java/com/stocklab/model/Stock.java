package com.stocklab.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stocks", uniqueConstraints = {
        @UniqueConstraint(columnNames = "ticker")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, unique = true, length = 10)
    private String ticker;

    @NotBlank
    @Column(nullable = false)
    private String companyName;

    @Column(length = 10)
    private String exchange; // HOSE, HNX, UPCOM

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal currentPrice = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal openPrice = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal highPrice = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal lowPrice = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal referencePrice = BigDecimal.ZERO;

    @Builder.Default
    private Long volume = 0L;

    @Column(name = "price_change", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal change = BigDecimal.ZERO;

    @Builder.Default
    private Double changePercent = 0.0;

    @Column(nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

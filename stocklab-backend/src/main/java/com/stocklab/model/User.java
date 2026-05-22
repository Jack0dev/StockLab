package com.stocklab.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(columnNames = "username"),
        @UniqueConstraint(columnNames = "email")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(min = 3, max = 50)
    @Column(nullable = false, unique = true)
    private String username;

    @NotBlank
    @Email
    @Column(nullable = false, unique = true)
    private String email;

    @NotBlank
    @Column(nullable = false)
    private String password;

    @Size(max = 100)
    private String fullName;

    @Size(max = 15)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Role role = Role.USER;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal balance = new BigDecimal("10000000.00"); // 10 triệu VND mặc định

    @Column(nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal lockedBalance = BigDecimal.ZERO; // Tiền bị lock cho lệnh BUY đang PENDING

    @Column(columnDefinition = "LONGTEXT")
    private String avatarUrl;

    @Column(name = "is2fa_enabled", nullable = false)
    @Builder.Default
    private boolean is2faEnabled = false;

    @Column(name = "two_fa_secret")
    private String twoFaSecret;

    /**
     * Số dư khả dụng = tổng số dư - tiền đang lock
     */
    public BigDecimal getAvailableBalance() {
        return balance.subtract(lockedBalance);
    }

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

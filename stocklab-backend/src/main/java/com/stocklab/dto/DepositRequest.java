package com.stocklab.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class DepositRequest {
    private BigDecimal amount;
    private String bankAccount; // Tùy chọn, thông tin ngân hàng nạp
    private String bankName; // Tùy chọn
}

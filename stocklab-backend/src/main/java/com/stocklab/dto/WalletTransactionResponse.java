package com.stocklab.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.Date;

@Data
@Builder
public class WalletTransactionResponse {
    private Long id;
    private String type;
    private BigDecimal amount;
    private String status;
    private String bankAccount;
    private String bankName;
    private String transactionCode;
    private String note;
    private Date createdAt;
    
    // Admin receiving bank details (for deposit)
    private String systemBankAccount;
    private String systemAccountName;
    private String systemBankName;
}

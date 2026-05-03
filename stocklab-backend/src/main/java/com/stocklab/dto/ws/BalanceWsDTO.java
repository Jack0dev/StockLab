package com.stocklab.dto.ws;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class BalanceWsDTO extends BaseWsDTO {
    private BigDecimal balance;
    private BigDecimal availableBalance;
    private BigDecimal lockedBalance;

    public BalanceWsDTO(BigDecimal balance, BigDecimal availableBalance, BigDecimal lockedBalance) {
        super("BALANCE_UPDATE");
        this.balance = balance;
        this.availableBalance = availableBalance;
        this.lockedBalance = lockedBalance;
    }
}

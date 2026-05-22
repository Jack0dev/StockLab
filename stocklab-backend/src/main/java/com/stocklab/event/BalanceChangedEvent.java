package com.stocklab.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class BalanceChangedEvent extends ApplicationEvent {
    public enum BalanceReason { TRADE, DEPOSIT, WITHDRAW, FEE, ORDER_LOCK, ORDER_UNLOCK }

    private final String username;
    private final BalanceReason reason;

    public BalanceChangedEvent(Object source, String username) {
        super(source);
        this.username = username;
        this.reason = null; // for backward compatibility if missed any
    }

    public BalanceChangedEvent(Object source, String username, BalanceReason reason) {
        super(source);
        this.username = username;
        this.reason = reason;
    }
}

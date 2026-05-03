package com.stocklab.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class BalanceChangedEvent extends ApplicationEvent {
    private final String username;

    public BalanceChangedEvent(Object source, String username) {
        super(source);
        this.username = username;
    }
}

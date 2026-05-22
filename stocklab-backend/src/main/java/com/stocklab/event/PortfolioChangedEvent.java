package com.stocklab.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class PortfolioChangedEvent extends ApplicationEvent {
    private final String username;

    public PortfolioChangedEvent(Object source, String username) {
        super(source);
        this.username = username;
    }
}

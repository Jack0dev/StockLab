package com.stocklab.event;

import org.springframework.context.ApplicationEvent;

public class OrderBookUpdatedEvent extends ApplicationEvent {
    private final String ticker;

    public OrderBookUpdatedEvent(Object source, String ticker) {
        super(source);
        this.ticker = ticker;
    }

    public String getTicker() {
        return ticker;
    }
}

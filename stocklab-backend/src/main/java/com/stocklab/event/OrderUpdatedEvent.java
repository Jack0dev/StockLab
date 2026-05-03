package com.stocklab.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import com.stocklab.dto.OrderResponse;

@Getter
public class OrderUpdatedEvent extends ApplicationEvent {
    private final String username;
    private final OrderResponse orderResponse;

    public OrderUpdatedEvent(Object source, String username, OrderResponse orderResponse) {
        super(source);
        this.username = username;
        this.orderResponse = orderResponse;
    }
}

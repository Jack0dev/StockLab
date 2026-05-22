package com.stocklab.event;

import com.stocklab.dto.TransactionResponse;
import org.springframework.context.ApplicationEvent;

public class TransactionCreatedEvent extends ApplicationEvent {
    private final String username;
    private final TransactionResponse transactionResponse;

    public TransactionCreatedEvent(Object source, String username, TransactionResponse transactionResponse) {
        super(source);
        this.username = username;
        this.transactionResponse = transactionResponse;
    }

    public String getUsername() {
        return username;
    }

    public TransactionResponse getTransactionResponse() {
        return transactionResponse;
    }
}

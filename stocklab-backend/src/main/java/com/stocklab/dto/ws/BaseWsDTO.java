package com.stocklab.dto.ws;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
public class BaseWsDTO {
    private String eventId = UUID.randomUUID().toString();
    private long timestamp = System.currentTimeMillis();
    private int version = 1;
    private String type;

    public BaseWsDTO(String type) {
        this.type = type;
    }
}

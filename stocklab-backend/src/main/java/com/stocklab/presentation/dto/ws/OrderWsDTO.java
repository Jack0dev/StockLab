package com.stocklab.presentation.dto.ws;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import com.stocklab.presentation.dto.OrderResponse;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class OrderWsDTO extends BaseWsDTO {
    private OrderResponse order;

    public OrderWsDTO(OrderResponse order) {
        super("ORDER_UPDATE");
        this.order = order;
    }
}

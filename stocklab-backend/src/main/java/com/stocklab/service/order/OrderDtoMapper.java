package com.stocklab.service.order;

import com.stocklab.presentation.dto.OrderResponse;
import com.stocklab.presentation.dto.PortfolioResponse;
import com.stocklab.presentation.dto.TransactionResponse;
import com.stocklab.domain.model.Order;
import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.Transaction;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class OrderDtoMapper {

    public static OrderResponse toOrderResponse(Order order) {
        if (order == null) return null;
        return OrderResponse.builder()
                .id(order.getId())
                .user(order.getUser() != null ? OrderResponse.UserDto.builder()
                        .id(order.getUser().getId())
                        .username(order.getUser().getUsername())
                        .email(order.getUser().getEmail())
                        .build() : null)
                .ticker(order.getStock() != null ? order.getStock().getTicker() : null)
                .companyName(order.getStock() != null ? order.getStock().getCompanyName() : null)
                .side(order.getSide() != null ? order.getSide().name() : null)
                .orderType(order.getOrderType() != null ? order.getOrderType().name() : null)
                .quantity(order.getQuantity())
                .filledQuantity(order.getFilledQuantity())
                .price(order.getPrice())
                .status(order.getStatus() != null ? order.getStatus().name() : null)
                .timeInForce(order.getTimeInForce() != null ? order.getTimeInForce().name() : null)
                .stopPrice(order.getStopPrice())
                .trailingDelta(order.getTrailingDelta())
                .activationPrice(order.getActivationPrice())
                .ocoGroupId(order.getOcoGroupId())
                .triggered(order.getTriggered())
                .triggeredAt(order.getTriggeredAt())
                .expiryDate(order.getExpiryDate())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    public static TransactionResponse toTransactionResponse(Transaction tx) {
        if (tx == null) return null;
        return TransactionResponse.builder()
                .id(tx.getId())
                .ticker(tx.getStock() != null ? tx.getStock().getTicker() : null)
                .companyName(tx.getStock() != null ? tx.getStock().getCompanyName() : null)
                .type(tx.getType() != null ? tx.getType().name() : null)
                .quantity(tx.getQuantity())
                .price(tx.getPrice())
                .totalAmount(tx.getTotalAmount())
                .createdAt(tx.getCreatedAt())
                .build();
    }

    public static PortfolioResponse toPortfolioResponse(Portfolio p) {
        if (p == null) return null;
        Stock stock = p.getStock();
        BigDecimal currentPrice = stock != null ? stock.getCurrentPrice() : BigDecimal.ZERO;
        BigDecimal avgBuyPrice = p.getAvgBuyPrice() != null ? p.getAvgBuyPrice() : BigDecimal.ZERO;
        int qty = p.getQuantity();

        BigDecimal totalValue = currentPrice.multiply(BigDecimal.valueOf(qty));
        BigDecimal profitLoss = currentPrice.subtract(avgBuyPrice).multiply(BigDecimal.valueOf(qty));

        double profitLossPercent = 0.0;
        if (avgBuyPrice.compareTo(BigDecimal.ZERO) > 0) {
            profitLossPercent = currentPrice.subtract(avgBuyPrice)
                    .divide(avgBuyPrice, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
        }

        return PortfolioResponse.builder()
                .id(p.getId())
                .ticker(stock != null ? stock.getTicker() : null)
                .companyName(stock != null ? stock.getCompanyName() : null)
                .exchange(stock != null ? stock.getExchange() : null)
                .quantity(qty)
                .avgBuyPrice(avgBuyPrice)
                .currentPrice(currentPrice)
                .totalValue(totalValue)
                .profitLoss(profitLoss)
                .profitLossPercent(profitLossPercent)
                .build();
    }

    public static String formatCurrency(BigDecimal amount) {
        if (amount == null) return "0";
        return String.format("%,.0f", amount);
    }
}

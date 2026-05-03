package com.stocklab.listener;

import com.stocklab.dto.ws.BalanceWsDTO;
import com.stocklab.dto.ws.OrderWsDTO;
import com.stocklab.dto.ws.PortfolioWsDTO;
import com.stocklab.event.BalanceChangedEvent;
import com.stocklab.event.OrderUpdatedEvent;
import com.stocklab.event.PortfolioChangedEvent;
import com.stocklab.model.User;
import com.stocklab.repository.UserRepository;
import com.stocklab.service.OrderService;
import com.stocklab.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import com.stocklab.dto.PortfolioResponse;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final WebSocketService webSocketService;
    private final UserRepository userRepository;
    private final OrderService orderService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleBalanceChanged(BalanceChangedEvent event) {
        try {
            String username = event.getUsername();
            User user = userRepository.findByUsername(username).orElse(null);
            if (user != null) {
                BalanceWsDTO dto = new BalanceWsDTO(user.getBalance(), user.getAvailableBalance(), user.getLockedBalance());
                webSocketService.broadcastUserBalance(username, dto);
            }
        } catch (Exception e) {
            log.error("Error handling BalanceChangedEvent for user {}: {}", event.getUsername(), e.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handlePortfolioChanged(PortfolioChangedEvent event) {
        try {
            String username = event.getUsername();
            List<PortfolioResponse> portfolios = orderService.getPortfolio(username).getData();
            if (portfolios != null) {
                PortfolioWsDTO dto = new PortfolioWsDTO(portfolios);
                webSocketService.broadcastUserPortfolio(username, dto);
            }
        } catch (Exception e) {
            log.error("Error handling PortfolioChangedEvent for user {}: {}", event.getUsername(), e.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleOrderUpdated(OrderUpdatedEvent event) {
        try {
            String username = event.getUsername();
            OrderWsDTO dto = new OrderWsDTO(event.getOrderResponse());
            webSocketService.broadcastUserOrder(username, dto);
        } catch (Exception e) {
            log.error("Error handling OrderUpdatedEvent for user {}: {}", event.getUsername(), e.getMessage());
        }
    }
}

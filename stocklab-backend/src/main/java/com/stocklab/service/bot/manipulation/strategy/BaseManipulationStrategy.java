package com.stocklab.service.bot.manipulation.strategy;

import com.stocklab.domain.model.OrderSide;
import com.stocklab.domain.model.OrderType;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.TradingConstants;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.presentation.dto.OrderRequest;
import com.stocklab.service.OrderService;
import com.stocklab.service.WebSocketService;
import com.stocklab.service.bot.manipulation.engine.BotFundManager;
import com.stocklab.service.bot.manipulation.model.CampaignContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@RequiredArgsConstructor
@Slf4j
public abstract class BaseManipulationStrategy implements ManipulationStrategy {

    protected final OrderService orderService;
    protected final StockRepository stockRepository;
    protected final BotFundManager botFundManager;
    protected final WebSocketService webSocketService;

    @Override
    public void onCampaignStart(CampaignContext context) {
        context.setStartTime(LocalDateTime.now());
        context.setPhaseStartTime(LocalDateTime.now());
        context.setLastTickTime(LocalDateTime.now());
        context.setCurrentPhaseIndex(0);

        var phases = getScenarioType().getPhases();
        if (!phases.isEmpty()) {
            context.setCurrentPhase(phases.get(0));
        }

        // Lưu giá bắt đầu của các cổ phiếu
        for (String ticker : context.getTickers()) {
            stockRepository.findByTicker(ticker).ifPresent(s -> {
                BigDecimal current = s.getCurrentPrice() != null ? s.getCurrentPrice() : s.getReferencePrice();
                context.getStartingPrices().put(ticker, current);
            });
        }
        context.logEvent("Chiến dịch " + getScenarioType().getTitleVi() + " bắt đầu.");
    }

    @Override
    public void onCampaignStop(CampaignContext context) {
        context.logEvent("Chiến dịch " + getScenarioType().getTitleVi() + " kết thúc.");
    }

    /**
     * Kẹp cứng giá trong khoảng Trần/Sàn của sàn và làm tròn theo bước giá 100 VNĐ
     */
    protected BigDecimal clampAndRoundPrice(BigDecimal targetPrice, Stock stock) {
        if (targetPrice == null || stock == null) return BigDecimal.ZERO;

        BigDecimal refPrice = stock.getReferencePrice() != null ? stock.getReferencePrice() : stock.getCurrentPrice();
        if (refPrice == null || refPrice.compareTo(BigDecimal.ZERO) <= 0) {
            refPrice = targetPrice;
        }

        String exchange = stock.getExchange() != null ? stock.getExchange() : "HOSE";
        BigDecimal ceiling = TradingConstants.calculateCeilingPrice(refPrice, exchange);
        BigDecimal floor = TradingConstants.calculateFloorPrice(refPrice, exchange);

        // Làm tròn bước giá 100 VNĐ
        BigDecimal rounded = targetPrice.divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        if (ceiling != null && rounded.compareTo(ceiling) > 0) {
            rounded = ceiling;
        }
        if (floor != null && rounded.compareTo(floor) < 0) {
            rounded = floor;
        }
        return rounded;
    }

    /**
     * Đặt lệnh an toàn thông qua OrderService
     */
    protected boolean safePlaceOrder(String botName, Stock stock, OrderSide side, OrderType type,
                                    int quantity, BigDecimal price, CampaignContext ctx) {
        if (botName == null || stock == null || quantity <= 0) {
            return false;
        }
        // Quy cách lô chẵn 100
        int cleanQty = (quantity / 100) * 100;
        if (cleanQty < 100) cleanQty = 100;

        try {
            OrderRequest req = new OrderRequest();
            req.setTicker(stock.getTicker());
            req.setSide(side.name());
            req.setOrderType(type.name());
            req.setQuantity(cleanQty);
            if (type == OrderType.LIMIT) {
                req.setPrice(clampAndRoundPrice(price, stock));
            }

            orderService.placeOrder(botName, req);

            ctx.getTotalOrdersPlaced().incrementAndGet();
            ctx.getTotalVolumeTraded().addAndGet(cleanQty);

            ctx.logEvent(String.format("%s: %s %d %s giá %s",
                    botName, side.name(), cleanQty, stock.getTicker(),
                    type == OrderType.LIMIT ? price : "MP"));

            // Broadcast websocket nếu có
            if (webSocketService != null) {
                webSocketService.broadcastBotOrder(stock.getTicker(), side.name(), cleanQty,
                        type == OrderType.LIMIT ? price : stock.getCurrentPrice());
            }
            return true;
        } catch (Exception e) {
            log.warn("Manipulation order failed for {}: {}", stock.getTicker(), e.getMessage());
            return false;
        }
    }
}

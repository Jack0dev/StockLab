package com.stocklab.service.bot.manipulation.strategy;

import com.stocklab.domain.model.OrderSide;
import com.stocklab.domain.model.OrderType;
import com.stocklab.domain.model.Stock;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.service.OrderService;
import com.stocklab.service.WebSocketService;
import com.stocklab.service.bot.manipulation.engine.BotFundManager;
import com.stocklab.service.bot.manipulation.model.CampaignContext;
import com.stocklab.service.bot.manipulation.model.ScenarioType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Random;

@Component
@Slf4j
public class SidewayStrategy extends BaseManipulationStrategy {

    private final Random random = new Random();

    public SidewayStrategy(OrderService orderService,
                           StockRepository stockRepository,
                           BotFundManager botFundManager,
                           WebSocketService webSocketService) {
        super(orderService, stockRepository, botFundManager, webSocketService);
    }

    @Override
    public ScenarioType getScenarioType() {
        return ScenarioType.SIDEWAY_ACCUMULATION;
    }

    @Override
    public void executeStep(CampaignContext context) {
        double progress = context.getProgressPercent();

        if (progress < 25.0) {
            context.setCurrentPhaseIndex(0);
            context.setCurrentPhase("DUNG_TUONG_CHAN");
        } else {
            context.setCurrentPhaseIndex(1);
            context.setCurrentPhase("GOM_HANG_BIEN_HEP");
        }

        double multiplier = context.getIntensity() != null ? context.getIntensity().getVolumeMultiplier() : 1.0;

        for (String ticker : context.getTickers()) {
            stockRepository.findByTicker(ticker).ifPresent(stock -> {
                BigDecimal anchor = stock.getReferencePrice() != null ? stock.getReferencePrice() : stock.getCurrentPrice();
                if (anchor == null || anchor.compareTo(BigDecimal.ZERO) <= 0) return;

                // Tường bán ở biên trên (+1%)
                BigDecimal upperWall = anchor.multiply(BigDecimal.valueOf(1.01));
                int wallQty = (int) (1500 * multiplier);
                botFundManager.selectBestSeller(ticker, wallQty).ifPresent(seller ->
                        safePlaceOrder(seller, stock, OrderSide.SELL, OrderType.LIMIT, wallQty, upperWall, context));

                // Tường mua ở biên dưới (-1%)
                BigDecimal lowerWall = anchor.multiply(BigDecimal.valueOf(0.99));
                botFundManager.selectBestBuyer(lowerWall.multiply(BigDecimal.valueOf(wallQty))).ifPresent(buyer ->
                        safePlaceOrder(buyer, stock, OrderSide.BUY, OrderType.LIMIT, wallQty, lowerWall, context));

                // Khớp gom biên hẹp ở giữa
                if ("GOM_HANG_BIEN_HEP".equals(context.getCurrentPhase())) {
                    BigDecimal midPrice = anchor.multiply(BigDecimal.valueOf(0.997 + random.nextDouble() * 0.006));
                    int midQty = (int) ((random.nextInt(5) + 2) * 100 * multiplier);

                    botFundManager.selectBestBuyer(midPrice.multiply(BigDecimal.valueOf(midQty))).ifPresent(buyer ->
                            safePlaceOrder(buyer, stock, OrderSide.BUY, OrderType.LIMIT, midQty, midPrice, context));
                }
            });
        }
    }
}

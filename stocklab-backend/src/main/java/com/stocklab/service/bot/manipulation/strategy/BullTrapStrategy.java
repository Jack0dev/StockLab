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
public class BullTrapStrategy extends BaseManipulationStrategy {

    private final Random random = new Random();

    public BullTrapStrategy(OrderService orderService,
                            StockRepository stockRepository,
                            BotFundManager botFundManager,
                            WebSocketService webSocketService) {
        super(orderService, stockRepository, botFundManager, webSocketService);
    }

    @Override
    public ScenarioType getScenarioType() {
        return ScenarioType.BULL_TRAP;
    }

    @Override
    public void executeStep(CampaignContext context) {
        double progress = context.getProgressPercent();

        if (progress < 40.0) {
            context.setCurrentPhaseIndex(0);
            context.setCurrentPhase("KEO_VUOT_DINH_AO");
        } else {
            context.setCurrentPhaseIndex(1);
            context.setCurrentPhase("UP_SOT_DAO_CHIEU");
        }

        double multiplier = context.getIntensity() != null ? context.getIntensity().getVolumeMultiplier() : 1.0;

        for (String ticker : context.getTickers()) {
            stockRepository.findByTicker(ticker).ifPresent(stock -> {
                BigDecimal current = stock.getCurrentPrice() != null ? stock.getCurrentPrice() : stock.getReferencePrice();
                if (current == null || current.compareTo(BigDecimal.ZERO) <= 0) return;

                if ("KEO_VUOT_DINH_AO".equals(context.getCurrentPhase())) {
                    // Kéo giá tăng mạnh vượt đỉnh tạo hiệu ứng breakout giả
                    BigDecimal breakoutPrice = current.multiply(BigDecimal.valueOf(1.025 + random.nextDouble() * 0.025));
                    int qty = (int) ((random.nextInt(10) + 5) * 100 * multiplier);

                    botFundManager.selectBestBuyer(breakoutPrice.multiply(BigDecimal.valueOf(qty))).ifPresent(buyer -> {
                        OrderType type = random.nextDouble() < 0.6 ? OrderType.MARKET : OrderType.LIMIT;
                        safePlaceOrder(buyer, stock, OrderSide.BUY, type, qty, breakoutPrice, context);
                    });
                } else {
                    // Úp sọt đảo chiều: Xả hàng loạt lệnh bán lớn vào bên mua
                    BigDecimal dumpPrice = current.multiply(BigDecimal.valueOf(0.96 - random.nextDouble() * 0.02));
                    int qty = (int) ((random.nextInt(20) + 10) * 100 * multiplier);

                    botFundManager.selectBestSeller(ticker, qty).ifPresent(seller -> {
                        OrderType type = random.nextDouble() < 0.7 ? OrderType.MARKET : OrderType.LIMIT;
                        safePlaceOrder(seller, stock, OrderSide.SELL, type, qty, dumpPrice, context);
                    });
                }
            });
        }
    }
}

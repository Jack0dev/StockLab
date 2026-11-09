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
public class PumpAndDumpStrategy extends BaseManipulationStrategy {

    private final Random random = new Random();

    public PumpAndDumpStrategy(OrderService orderService,
                               StockRepository stockRepository,
                               BotFundManager botFundManager,
                               WebSocketService webSocketService) {
        super(orderService, stockRepository, botFundManager, webSocketService);
    }

    @Override
    public ScenarioType getScenarioType() {
        return ScenarioType.PUMP_AND_DUMP;
    }

    @Override
    public void executeStep(CampaignContext context) {
        double progress = context.getProgressPercent();

        // Chuyển pha theo tiến độ thời gian
        if (progress < 30.0) {
            context.setCurrentPhaseIndex(0);
            context.setCurrentPhase("GOM_HANG");
        } else if (progress < 60.0) {
            context.setCurrentPhaseIndex(1);
            context.setCurrentPhase("BOM_GIA_PUMP");
        } else if (progress < 80.0) {
            context.setCurrentPhaseIndex(2);
            context.setCurrentPhase("PHAN_PHOI");
        } else {
            context.setCurrentPhaseIndex(3);
            context.setCurrentPhase("XA_HANG_DUMP");
        }

        double multiplier = context.getIntensity() != null ? context.getIntensity().getVolumeMultiplier() : 1.0;

        for (String ticker : context.getTickers()) {
            stockRepository.findByTicker(ticker).ifPresent(stock -> {
                BigDecimal current = stock.getCurrentPrice() != null ? stock.getCurrentPrice() : stock.getReferencePrice();
                if (current == null || current.compareTo(BigDecimal.ZERO) <= 0) return;

                switch (context.getCurrentPhase()) {
                    case "GOM_HANG" -> {
                        // Gom hàng ngầm: mua khối lượng nhỏ quanh tham chiếu
                        BigDecimal buyPrice = current.multiply(BigDecimal.valueOf(0.99 + random.nextDouble() * 0.015));
                        int qty = (int) ((random.nextInt(3) + 1) * 100 * multiplier);
                        botFundManager.selectBestBuyer(buyPrice.multiply(BigDecimal.valueOf(qty)))
                                .ifPresent(buyer -> safePlaceOrder(buyer, stock, OrderSide.BUY, OrderType.LIMIT, qty, buyPrice, context));
                    }
                    case "BOM_GIA_PUMP" -> {
                        // Bơm giá: đặt lệnh BUY MARKET hoặc BUY LIMIT cao hơn giá hiện tại 1 - 3%
                        BigDecimal target = current.multiply(BigDecimal.valueOf(1.02 + random.nextDouble() * 0.02));
                        int qty = (int) ((random.nextInt(10) + 5) * 100 * multiplier);
                        botFundManager.selectBestBuyer(target.multiply(BigDecimal.valueOf(qty)))
                                .ifPresent(buyer -> {
                                    OrderType type = random.nextDouble() < 0.4 ? OrderType.MARKET : OrderType.LIMIT;
                                    safePlaceOrder(buyer, stock, OrderSide.BUY, type, qty, target, context);
                                });
                    }
                    case "PHAN_PHOI" -> {
                        // Phân phối: Mua nhỏ mồi giá, xả bán lớn Limit
                        int buyQty = (int) (100 * multiplier);
                        botFundManager.selectBestBuyer(current.multiply(BigDecimal.valueOf(buyQty)))
                                .ifPresent(buyer -> safePlaceOrder(buyer, stock, OrderSide.BUY, OrderType.LIMIT, buyQty, current, context));

                        int sellQty = (int) ((random.nextInt(15) + 10) * 100 * multiplier);
                        botFundManager.selectBestSeller(ticker, sellQty)
                                .ifPresent(seller -> safePlaceOrder(seller, stock, OrderSide.SELL, OrderType.LIMIT, sellQty, current, context));
                    }
                    case "XA_HANG_DUMP" -> {
                        // Xả hàng: xả dứt khoát bằng lệnh Market hoặc giá sàn
                        int sellQty = (int) ((random.nextInt(25) + 15) * 100 * multiplier);
                        botFundManager.selectBestSeller(ticker, sellQty)
                                .ifPresent(seller -> {
                                    OrderType type = random.nextDouble() < 0.6 ? OrderType.MARKET : OrderType.LIMIT;
                                    BigDecimal lowPrice = current.multiply(BigDecimal.valueOf(0.94));
                                    safePlaceOrder(seller, stock, OrderSide.SELL, type, sellQty, lowPrice, context);
                                });
                    }
                }
            });
        }
    }
}

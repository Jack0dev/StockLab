package com.stocklab.service.bot.manipulation.strategy;

import com.stocklab.domain.model.OrderSide;
import com.stocklab.domain.model.OrderType;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.TradingConstants;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.service.OrderService;
import com.stocklab.service.WebSocketService;
import com.stocklab.service.bot.manipulation.engine.BotFundManager;
import com.stocklab.service.bot.manipulation.model.CampaignContext;
import com.stocklab.service.bot.manipulation.model.ScenarioType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Slf4j
public class LockLimitStrategy extends BaseManipulationStrategy {

    public LockLimitStrategy(OrderService orderService,
                             StockRepository stockRepository,
                             BotFundManager botFundManager,
                             WebSocketService webSocketService) {
        super(orderService, stockRepository, botFundManager, webSocketService);
    }

    @Override
    public ScenarioType getScenarioType() {
        return ScenarioType.LOCK_LIMIT;
    }

    @Override
    public void executeStep(CampaignContext context) {
        context.setCurrentPhaseIndex(0);
        context.setCurrentPhase("CHAT_LENH_KHOA_BIEN_DO");

        boolean isLockFloor = "LOCK_FLOOR".equalsIgnoreCase(context.getCustomMode());
        double multiplier = context.getIntensity() != null ? context.getIntensity().getVolumeMultiplier() : 1.0;

        for (String ticker : context.getTickers()) {
            stockRepository.findByTicker(ticker).ifPresent(stock -> {
                BigDecimal ref = stock.getReferencePrice() != null ? stock.getReferencePrice() : stock.getCurrentPrice();
                if (ref == null || ref.compareTo(BigDecimal.ZERO) <= 0) return;

                String exchange = stock.getExchange() != null ? stock.getExchange() : "HOSE";

                if (isLockFloor) {
                    // Khóa Sàn: Đặt khối lượng bán sàn cực lớn
                    BigDecimal floor = TradingConstants.calculateFloorPrice(ref, exchange);
                    int lockQty = (int) (5000 * multiplier);

                    var slices = botFundManager.splitSellOrder(ticker, lockQty, floor);
                    if (slices.isEmpty()) {
                        botFundManager.selectBestSeller(ticker, 100).ifPresent(seller ->
                                safePlaceOrder(seller, stock, OrderSide.SELL, OrderType.LIMIT, 100, floor, context));
                    } else {
                        for (var slice : slices) {
                            safePlaceOrder(slice.botUsername(), stock, OrderSide.SELL, OrderType.LIMIT, slice.quantity(), floor, context);
                        }
                    }
                } else {
                    // Khóa Trần: Đặt khối lượng mua trần cực lớn
                    BigDecimal ceiling = TradingConstants.calculateCeilingPrice(ref, exchange);
                    int lockQty = (int) (5000 * multiplier);

                    var slices = botFundManager.splitBuyOrder(lockQty, ceiling);
                    if (slices.isEmpty()) {
                        botFundManager.selectBestBuyer(ceiling.multiply(BigDecimal.valueOf(100))).ifPresent(buyer ->
                                safePlaceOrder(buyer, stock, OrderSide.BUY, OrderType.LIMIT, 100, ceiling, context));
                    } else {
                        for (var slice : slices) {
                            safePlaceOrder(slice.botUsername(), stock, OrderSide.BUY, OrderType.LIMIT, slice.quantity(), ceiling, context);
                        }
                    }
                }
            });
        }
    }
}

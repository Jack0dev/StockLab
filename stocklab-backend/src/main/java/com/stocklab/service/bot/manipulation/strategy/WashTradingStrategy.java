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
public class WashTradingStrategy extends BaseManipulationStrategy {

    private final Random random = new Random();

    public WashTradingStrategy(OrderService orderService,
                               StockRepository stockRepository,
                               BotFundManager botFundManager,
                               WebSocketService webSocketService) {
        super(orderService, stockRepository, botFundManager, webSocketService);
    }

    @Override
    public ScenarioType getScenarioType() {
        return ScenarioType.WASH_TRADING;
    }

    @Override
    public void executeStep(CampaignContext context) {
        context.setCurrentPhaseIndex(0);
        context.setCurrentPhase("QUAY_TAY_KHOP_CHEO");

        double multiplier = context.getIntensity() != null ? context.getIntensity().getVolumeMultiplier() : 1.0;

        for (String ticker : context.getTickers()) {
            stockRepository.findByTicker(ticker).ifPresent(stock -> {
                BigDecimal matchPrice = stock.getCurrentPrice() != null ? stock.getCurrentPrice() : stock.getReferencePrice();
                if (matchPrice == null || matchPrice.compareTo(BigDecimal.ZERO) <= 0) return;

                // Khối lượng lớn: 2.000 – 10.000 CP mỗi nhịp tick
                int tradeQty = (int) ((random.nextInt(30) + 15) * 100 * multiplier);

                // Tìm bot bán có sẵn cổ phiếu
                var sellerOpt = botFundManager.selectBestSeller(ticker, tradeQty);
                if (sellerOpt.isEmpty()) {
                    sellerOpt = botFundManager.selectBestSeller(ticker, 100);
                }

                // Tìm bot mua có đủ tiền mặt
                var buyerOpt = botFundManager.selectBestBuyer(matchPrice.multiply(BigDecimal.valueOf(tradeQty)));

                if (sellerOpt.isPresent() && buyerOpt.isPresent()) {
                    String seller = sellerOpt.get();
                    String buyer = buyerOpt.get();

                    // Đảm bảo không để cùng 1 bot tự bán tự mua cho chính mình (khác username)
                    if (seller.equals(buyer)) {
                        for (String otherBot : botFundManager.getAllBotUsernames()) {
                            if (!otherBot.equals(seller)) {
                                buyer = otherBot;
                                break;
                            }
                        }
                    }

                    // 1. Đặt lệnh Bán LIMIT trước
                    safePlaceOrder(seller, stock, OrderSide.SELL, OrderType.LIMIT, tradeQty, matchPrice, context);

                    // 2. Đặt lệnh Mua LIMIT cùng mức giá để khớp ngay lập tức trong MatchingEngine
                    safePlaceOrder(buyer, stock, OrderSide.BUY, OrderType.LIMIT, tradeQty, matchPrice, context);

                    log.debug("Wash trade executed on {}: {} -> {} ({} shares @ {})",
                            ticker, seller, buyer, tradeQty, matchPrice);
                }
            });
        }
    }
}

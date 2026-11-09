package com.stocklab.service.bot;

import com.stocklab.domain.model.Stock;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.service.OrderService;
import com.stocklab.service.WebSocketService;
import com.stocklab.service.bot.manipulation.engine.BotFundManager;
import com.stocklab.service.bot.manipulation.model.CampaignContext;
import com.stocklab.service.bot.manipulation.model.CampaignStatus;
import com.stocklab.service.bot.manipulation.model.ManipulationIntensity;
import com.stocklab.service.bot.manipulation.model.ScenarioType;
import com.stocklab.service.bot.manipulation.strategy.BearTrapStrategy;
import com.stocklab.service.bot.manipulation.strategy.PumpAndDumpStrategy;
import com.stocklab.service.bot.manipulation.strategy.WashTradingStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ManipulationStrategyTest {

    @Mock
    private OrderService orderService;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private BotFundManager botFundManager;

    @Mock
    private WebSocketService webSocketService;

    private Stock stockVcb;

    @BeforeEach
    void setUp() {
        stockVcb = Stock.builder()
                .id(1L)
                .ticker("VCB")
                .referencePrice(new BigDecimal("90000.00"))
                .currentPrice(new BigDecimal("90000.00"))
                .exchange("HOSE")
                .build();
    }

    @Test
    @DisplayName("Kịch bản Pump & Dump tự động chuyển 4 pha tuần tự theo tiến độ thời gian")
    void testPumpAndDumpPhasesTransition() {
        PumpAndDumpStrategy strategy = new PumpAndDumpStrategy(orderService, stockRepository, botFundManager, webSocketService);

        CampaignContext ctx = CampaignContext.builder()
                .campaignId("camp_test")
                .scenarioType(ScenarioType.PUMP_AND_DUMP)
                .tickers(List.of("VCB"))
                .durationMinutes(10) // 600s total
                .intensity(ManipulationIntensity.MEDIUM)
                .status(CampaignStatus.RUNNING)
                .build();

        strategy.onCampaignStart(ctx);

        when(stockRepository.findByTicker("VCB")).thenReturn(Optional.of(stockVcb));
        when(botFundManager.selectBestBuyer(any())).thenReturn(Optional.of("bot_01"));
        when(botFundManager.selectBestSeller(anyString(), anyInt())).thenReturn(Optional.of("bot_02"));

        // 1. Pha 1: 10% progress -> GOM_HANG
        ctx.setStartTime(LocalDateTime.now().minusSeconds(60));
        strategy.executeStep(ctx);
        assertEquals("GOM_HANG", ctx.getCurrentPhase());
        assertEquals(0, ctx.getCurrentPhaseIndex());

        // 2. Pha 2: 45% progress -> BOM_GIA_PUMP
        ctx.setStartTime(LocalDateTime.now().minusSeconds(270));
        strategy.executeStep(ctx);
        assertEquals("BOM_GIA_PUMP", ctx.getCurrentPhase());
        assertEquals(1, ctx.getCurrentPhaseIndex());

        // 3. Pha 3: 70% progress -> PHAN_PHOI
        ctx.setStartTime(LocalDateTime.now().minusSeconds(420));
        strategy.executeStep(ctx);
        assertEquals("PHAN_PHOI", ctx.getCurrentPhase());
        assertEquals(2, ctx.getCurrentPhaseIndex());

        // 4. Pha 4: 90% progress -> XA_HANG_DUMP
        ctx.setStartTime(LocalDateTime.now().minusSeconds(540));
        strategy.executeStep(ctx);
        assertEquals("XA_HANG_DUMP", ctx.getCurrentPhase());
        assertEquals(3, ctx.getCurrentPhaseIndex());
    }

    @Test
    @DisplayName("Kịch bản Bear Trap đè rũ cung pha 1 và quét sàn giật trần pha 2")
    void testBearTrapStrategyExecution() {
        BearTrapStrategy strategy = new BearTrapStrategy(orderService, stockRepository, botFundManager, webSocketService);

        CampaignContext ctx = CampaignContext.builder()
                .campaignId("camp_bear")
                .scenarioType(ScenarioType.BEAR_TRAP)
                .tickers(List.of("VCB"))
                .durationMinutes(5)
                .intensity(ManipulationIntensity.MEDIUM)
                .status(CampaignStatus.RUNNING)
                .build();

        strategy.onCampaignStart(ctx);
        when(stockRepository.findByTicker("VCB")).thenReturn(Optional.of(stockVcb));
        when(botFundManager.selectBestSeller(eq("VCB"), anyInt())).thenReturn(Optional.of("bot_05"));
        when(botFundManager.selectBestBuyer(any())).thenReturn(Optional.of("bot_06"));

        // Pha 1: 20% progress -> DE_GIA_RU_CUNG
        ctx.setStartTime(LocalDateTime.now().minusSeconds(60));
        strategy.executeStep(ctx);
        assertEquals("DE_GIA_RU_CUNG", ctx.getCurrentPhase());
        verify(orderService, atLeastOnce()).placeOrder(eq("bot_05"), any());

        // Pha 2: 80% progress -> QUET_SAN_GIAT_TRAN
        ctx.setStartTime(LocalDateTime.now().minusSeconds(240));
        strategy.executeStep(ctx);
        assertEquals("QUET_SAN_GIAT_TRAN", ctx.getCurrentPhase());
        verify(orderService, atLeastOnce()).placeOrder(eq("bot_06"), any());
    }

    @Test
    @DisplayName("Kịch bản Wash Trading đặt 2 lệnh Mua và Bán cùng mức giá khớp chéo")
    void testWashTradingStrategy() {
        WashTradingStrategy strategy = new WashTradingStrategy(orderService, stockRepository, botFundManager, webSocketService);

        CampaignContext ctx = CampaignContext.builder()
                .campaignId("camp_wash")
                .scenarioType(ScenarioType.WASH_TRADING)
                .tickers(List.of("VCB"))
                .durationMinutes(5)
                .intensity(ManipulationIntensity.MEDIUM)
                .status(CampaignStatus.RUNNING)
                .startTime(LocalDateTime.now())
                .build();

        when(stockRepository.findByTicker("VCB")).thenReturn(Optional.of(stockVcb));
        when(botFundManager.selectBestSeller(eq("VCB"), anyInt())).thenReturn(Optional.of("bot_03"));
        when(botFundManager.selectBestBuyer(any())).thenReturn(Optional.of("bot_04"));

        strategy.executeStep(ctx);

        assertEquals("QUAY_TAY_KHOP_CHEO", ctx.getCurrentPhase());
        // Phải có ít nhất 1 lệnh BUY và 1 lệnh SELL
        verify(orderService, atLeast(2)).placeOrder(anyString(), any());
        assertTrue(ctx.getTotalOrdersPlaced().get() >= 2);
    }
}

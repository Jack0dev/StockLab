package com.stocklab.service.bot;

import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.PortfolioRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import com.stocklab.service.bot.manipulation.engine.BotFundManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BotFundManagerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @InjectMocks
    private BotFundManager botFundManager;

    private User richBot;
    private User poorBot;
    private Stock stockHpg;

    @BeforeEach
    void setUp() {
        richBot = User.builder()
                .id(1L)
                .username("bot_01")
                .balance(new BigDecimal("500000000")) // 500 triệu
                .build();

        poorBot = User.builder()
                .id(2L)
                .username("bot_02")
                .balance(new BigDecimal("1000000")) // 1 triệu
                .build();

        stockHpg = Stock.builder()
                .id(10L)
                .ticker("HPG")
                .build();
    }

    @Test
    @DisplayName("Khởi tạo danh sách 20 bot đúng quy cách bot_01 đến bot_20")
    void testGetAllBotUsernames() {
        List<String> bots = botFundManager.getAllBotUsernames();
        assertEquals(20, bots.size());
        assertEquals("bot_01", bots.get(0));
        assertEquals("bot_20", bots.get(19));
    }

    @Test
    @DisplayName("Chọn bot mua có số dư lớn hơn yêu cầu")
    void testSelectBestBuyer_Success() {
        when(userRepository.findByUsername("bot_01")).thenReturn(Optional.of(richBot));
        when(userRepository.findByUsername("bot_02")).thenReturn(Optional.of(poorBot));

        Optional<String> buyer = botFundManager.selectBestBuyer(new BigDecimal("50000000"));
        assertTrue(buyer.isPresent());
        assertEquals("bot_01", buyer.get());
    }

    @Test
    @DisplayName("Chọn bot bán có đủ cổ phiếu khả dụng trong kho")
    void testSelectBestSeller_Success() {
        Portfolio p1 = Portfolio.builder()
                .id(100L)
                .user(richBot)
                .stock(stockHpg)
                .quantity(10000)
                .lockedQuantity(1000) // khả dụng 9000
                .build();

        when(userRepository.findByUsername("bot_01")).thenReturn(Optional.of(richBot));
        when(portfolioRepository.findByUserIdAndStockTicker(eq(1L), eq("HPG"))).thenReturn(Optional.of(p1));

        Optional<String> seller = botFundManager.selectBestSeller("HPG", 5000);
        assertTrue(seller.isPresent());
        assertEquals("bot_01", seller.get());
    }

    @Test
    @DisplayName("Chia nhỏ lệnh mua theo lô chẵn 100 và số dư từng bot")
    void testSplitBuyOrder() {
        when(userRepository.findByUsername(anyString())).thenAnswer(inv -> {
            String name = inv.getArgument(0);
            return Optional.of(User.builder()
                    .id(1L)
                    .username(name)
                    .balance(new BigDecimal("100000000.00")) // 100M VND
                    .build());
        });

        // Giá 50,000 VND, mua 2,000 CP = 100 triệu
        var slices = botFundManager.splitBuyOrder(2000, new BigDecimal("50000"));

        assertFalse(slices.isEmpty());
        int totalQuantity = slices.stream().mapToInt(BotFundManager.BotOrderSlice::quantity).sum();
        assertTrue(totalQuantity > 0);
        assertTrue(totalQuantity <= 2000);
        // Mỗi slice phải là lô chẵn 100
        for (var slice : slices) {
            assertEquals(0, slice.quantity() % 100);
        }
    }
}

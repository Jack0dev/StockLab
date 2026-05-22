package com.stocklab.engine;

import com.stocklab.model.*;
import com.stocklab.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PostTradeProcessor Tests")
class PostTradeProcessorTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PortfolioRepository portfolioRepository;
    @Mock
    private StockRepository stockRepository;

    @InjectMocks
    private PostTradeProcessor processor;

    private User buyer;
    private User seller;
    private Stock stock;
    private Portfolio sellerPortfolio;
    private Order buyOrder;
    private Order sellOrder;
    private MatchResult matchResult;

    @BeforeEach
    void setUp() {
        stock = Stock.builder()
                .id(1L).ticker("VNM").companyName("Vinamilk")
                .currentPrice(new BigDecimal("80000.00"))
                .highPrice(new BigDecimal("82000.00"))
                .lowPrice(new BigDecimal("78000.00"))
                .volume(1000L)
                .build();

        buyer = User.builder()
                .id(1L).username("buyer").email("buyer@test.com").password("pw")
                .balance(new BigDecimal("10000000.00"))
                .lockedBalance(new BigDecimal("850000.00")) // lock 10 × 85000
                .build();

        seller = User.builder()
                .id(2L).username("seller").email("seller@test.com").password("pw")
                .balance(new BigDecimal("5000000.00"))
                .lockedBalance(BigDecimal.ZERO)
                .build();

        sellerPortfolio = Portfolio.builder()
                .id(1L).user(seller).stock(stock)
                .quantity(100).lockedQuantity(10)
                .avgBuyPrice(new BigDecimal("75000.00"))
                .build();

        buyOrder = Order.builder()
                .id(1L).user(buyer).stock(stock)
                .side(OrderSide.BUY).orderType(OrderType.LIMIT)
                .quantity(10).filledQuantity(10)
                .price(new BigDecimal("85000.00"))
                .status(OrderStatus.FILLED)
                .build();

        sellOrder = Order.builder()
                .id(2L).user(seller).stock(stock)
                .side(OrderSide.SELL).orderType(OrderType.LIMIT)
                .quantity(10).filledQuantity(10)
                .price(new BigDecimal("85000.00"))
                .status(OrderStatus.FILLED)
                .build();

        matchResult = MatchResult.builder()
                .buyOrder(buyOrder)
                .sellOrder(sellOrder)
                .matchPrice(new BigDecimal("85000.00"))
                .matchQuantity(10)
                .build();
    }

    // ===== Transaction Tests =====

    @Nested
    @DisplayName("Transaction — tạo 2 record BUY + SELL")
    class TransactionTests {

        @Test
        @DisplayName("Tạo BUY transaction cho buyer")
        void shouldCreateBuyTransaction() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            lenient().when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            ArgumentCaptor<Transaction> captor = ArgumentCaptor.forClass(Transaction.class);
            verify(transactionRepository, times(2)).save(captor.capture());

            Transaction buyTx = captor.getAllValues().stream()
                    .filter(t -> t.getType() == TransactionType.BUY)
                    .findFirst().orElseThrow();

            assertEquals(buyer, buyTx.getUser());
            assertEquals(stock, buyTx.getStock());
            assertEquals(TransactionType.BUY, buyTx.getType());
            assertEquals(10, buyTx.getQuantity());
            assertEquals(new BigDecimal("85000.00"), buyTx.getPrice());
            assertEquals(new BigDecimal("850000.00"), buyTx.getTotalAmount());
        }

        @Test
        @DisplayName("Tạo SELL transaction cho seller")
        void shouldCreateSellTransaction() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            ArgumentCaptor<Transaction> captor = ArgumentCaptor.forClass(Transaction.class);
            verify(transactionRepository, times(2)).save(captor.capture());

            Transaction sellTx = captor.getAllValues().stream()
                    .filter(t -> t.getType() == TransactionType.SELL)
                    .findFirst().orElseThrow();

            assertEquals(seller, sellTx.getUser());
            assertEquals(TransactionType.SELL, sellTx.getType());
            assertEquals(10, sellTx.getQuantity());
            assertEquals(new BigDecimal("850000.00"), sellTx.getTotalAmount());
        }
    }

    // ===== Balance Tests =====

    @Nested
    @DisplayName("Balance — cập nhật tiền cho buyer và seller")
    class BalanceTests {

        @Test
        @DisplayName("Buyer: balance giảm, lockedBalance giảm")
        void shouldDeductBuyerBalanceAndUnlock() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            lenient().when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            // balance: 10,000,000 - 850,000 = 9,150,000
            assertEquals(new BigDecimal("9150000.00"), buyer.getBalance());
            // lockedBalance: 850,000 - 850,000 = 0
            assertEquals(new BigDecimal("0.00"), buyer.getLockedBalance().setScale(2));
            verify(userRepository).save(buyer);
        }

        @Test
        @DisplayName("Seller: balance tăng")
        void shouldAddToSellerBalance() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            // balance: 5,000,000 + 850,000 = 5,850,000
            assertEquals(new BigDecimal("5850000.00"), seller.getBalance());
            verify(userRepository).save(seller);
        }
    }

    // ===== Portfolio Tests =====

    @Nested
    @DisplayName("Portfolio — cập nhật danh mục")
    class PortfolioTests {

        @Test
        @DisplayName("Buyer chưa có portfolio → tạo mới với avgBuyPrice = matchPrice")
        void shouldCreateNewPortfolioForBuyer() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            lenient().when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            ArgumentCaptor<Portfolio> captor = ArgumentCaptor.forClass(Portfolio.class);
            verify(portfolioRepository, atLeast(1)).save(captor.capture());

            Portfolio buyerPortfolio = captor.getAllValues().stream()
                    .filter(p -> p.getUser().getId().equals(1L))
                    .findFirst().orElseThrow();

            assertEquals(10, buyerPortfolio.getQuantity());
            assertEquals(new BigDecimal("85000.00"), buyerPortfolio.getAvgBuyPrice());
        }

        @Test
        @DisplayName("Buyer đã có portfolio → cập nhật quantity + avgBuyPrice")
        void shouldUpdateExistingBuyerPortfolio() {
            // Buyer đã có 20 CP với avg = 80000
            Portfolio existingPortfolio = Portfolio.builder()
                    .id(2L).user(buyer).stock(stock)
                    .quantity(20).lockedQuantity(0)
                    .avgBuyPrice(new BigDecimal("80000.00"))
                    .build();

            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.of(existingPortfolio));
            lenient().when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            // quantity: 20 + 10 = 30
            assertEquals(30, existingPortfolio.getQuantity());
            // avgBuyPrice: (20 * 80000 + 10 * 85000) / 30 = 2,450,000 / 30 = 81666.67
            BigDecimal expectedAvg = new BigDecimal("81666.67");
            assertEquals(expectedAvg, existingPortfolio.getAvgBuyPrice());
        }

        @Test
        @DisplayName("Seller: portfolio giảm quantity, lockedQuantity giảm")
        void shouldReduceSellerPortfolio() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            // quantity: 100 - 10 = 90
            assertEquals(90, sellerPortfolio.getQuantity());
            // lockedQuantity: 10 - 10 = 0
            assertEquals(0, sellerPortfolio.getLockedQuantity());
            verify(portfolioRepository).save(sellerPortfolio);
        }

        @Test
        @DisplayName("Seller bán hết CP → xóa portfolio")
        void shouldDeletePortfolioWhenSellerSellsAll() {
            sellerPortfolio.setQuantity(10); // Có đúng 10, bán hết
            sellerPortfolio.setLockedQuantity(10);

            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            verify(portfolioRepository).delete(sellerPortfolio);
        }
    }

    // ===== Stock Price Tests =====

    @Nested
    @DisplayName("Stock Price — cập nhật giá")
    class StockPriceTests {

        @Test
        @DisplayName("currentPrice cập nhật = matchPrice")
        void shouldUpdateCurrentPrice() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            lenient().when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            assertEquals(new BigDecimal("85000.00"), stock.getCurrentPrice());
            verify(stockRepository).save(stock);
        }

        @Test
        @DisplayName("highPrice cập nhật khi matchPrice > highPrice hiện tại")
        void shouldUpdateHighPrice() {
            stock.setHighPrice(new BigDecimal("82000.00"));
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            lenient().when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            // 85000 > 82000 → update
            assertEquals(new BigDecimal("85000.00"), stock.getHighPrice());
        }

        @Test
        @DisplayName("volume cộng thêm matchQuantity")
        void shouldAddMatchQuantityToVolume() {
            when(portfolioRepository.findByUserIdAndStockId(1L, 1L))
                    .thenReturn(Optional.empty());
            lenient().when(portfolioRepository.findByUserIdAndStockId(2L, 1L))
                    .thenReturn(Optional.of(sellerPortfolio));

            processor.process(matchResult);

            // volume: 1000 + 10 = 1010
            assertEquals(1010L, stock.getVolume());
        }
    }
}

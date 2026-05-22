package com.stocklab.service;

import com.stocklab.dto.PlatformTokenResponse;
import com.stocklab.model.PlatformStats;
import com.stocklab.model.Stock;
import com.stocklab.repository.PlatformStatsRepository;
import com.stocklab.repository.StockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Service quản lý Token sàn SLP (StockLab Platform Token).
 *
 * Cơ chế:
 * - Mỗi giao dịch khớp lệnh, sàn thu phí 0.15% từ cả buyer lẫn seller.
 * - Tổng phí tích lũy → tăng giá SLP theo công thức:
 *   tokenPrice = basePrice × (1 + totalFees / initialMarketCap)
 * - Giá SLP phản ánh "lợi nhuận" và sức khoẻ của sàn.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlatformTokenService {

    private final PlatformStatsRepository statsRepository;
    private final StockRepository stockRepository;

    /** Tỷ lệ phí giao dịch: 0.15% mỗi bên */
    public static final BigDecimal FEE_RATE = new BigDecimal("0.0015");

    /** Token ticker */
    public static final String TOKEN_TICKER = "SLP";
    public static final String TOKEN_NAME = "StockLab Platform Token";

    /**
     * Lấy hoặc tạo PlatformStats singleton
     */
    public PlatformStats getOrCreateStats() {
        return statsRepository.findAll().stream().findFirst()
                .orElseGet(() -> {
                    PlatformStats stats = PlatformStats.builder()
                            .tokenBasePrice(new BigDecimal("10000"))
                            .tokenCurrentPrice(new BigDecimal("10000"))
                            .tokenTotalSupply(1_000_000L)
                            .lastResetDate(LocalDate.now())
                            .build();
                    return statsRepository.save(stats);
                });
    }

    /**
     * Ghi nhận phí giao dịch từ một lần khớp lệnh.
     * Gọi từ PostTradeProcessor.
     *
     * @param feeAmount   Tổng phí (buyer + seller)
     * @param tradeVolume Tổng giá trị giao dịch
     */
    @Transactional
    public void recordTradeFee(BigDecimal feeAmount, BigDecimal tradeVolume) {
        PlatformStats stats = getOrCreateStats();

        // Reset daily fees nếu sang ngày mới
        if (stats.getLastResetDate() == null || !stats.getLastResetDate().equals(LocalDate.now())) {
            stats.setDailyFees(BigDecimal.ZERO);
            stats.setLastResetDate(LocalDate.now());
        }

        stats.setTotalFeesCollected(stats.getTotalFeesCollected().add(feeAmount));
        stats.setDailyFees(stats.getDailyFees().add(feeAmount));
        stats.setTotalTradesCount(stats.getTotalTradesCount() + 1);
        stats.setTotalTradingVolume(stats.getTotalTradingVolume().add(tradeVolume));

        // Cập nhật giá token
        recalculateTokenPrice(stats);

        statsRepository.save(stats);
    }

    /**
     * Tính lại giá token SLP dựa trên tổng phí tích lũy.
     *
     * Công thức: tokenPrice = basePrice × (1 + totalFees / initialMarketCap)
     * Trong đó: initialMarketCap = basePrice × totalSupply
     *
     * Ví dụ:
     *   - Base 10,000 × 1,000,000 supply = 10 tỷ marketCap
     *   - Thu 100 triệu phí → price = 10,000 × (1 + 100M/10B) = 10,100 (+1%)
     *   - Thu 1 tỷ phí → price = 10,000 × (1 + 1B/10B) = 11,000 (+10%)
     */
    private void recalculateTokenPrice(PlatformStats stats) {
        BigDecimal basePrice = stats.getTokenBasePrice();
        BigDecimal initialMarketCap = basePrice.multiply(BigDecimal.valueOf(stats.getTokenTotalSupply()));

        if (initialMarketCap.compareTo(BigDecimal.ZERO) <= 0) return;

        // profitRatio = totalFees / initialMarketCap
        BigDecimal profitRatio = stats.getTotalFeesCollected()
                .divide(initialMarketCap, 8, RoundingMode.HALF_UP);

        // newPrice = basePrice × (1 + profitRatio)
        BigDecimal newPrice = basePrice.multiply(BigDecimal.ONE.add(profitRatio))
                .setScale(2, RoundingMode.HALF_UP);

        stats.setTokenCurrentPrice(newPrice);
        
        // Update the actual Stock entity in the database
        stockRepository.findByTicker(TOKEN_TICKER).ifPresent(slpStock -> {
            slpStock.setReferencePrice(newPrice);
            slpStock.setCurrentPrice(newPrice); 
            if (newPrice.compareTo(slpStock.getHighPrice()) > 0) {
                slpStock.setHighPrice(newPrice);
            }
            stockRepository.save(slpStock);
        });
    }

    /**
     * Lấy thông tin token SLP cho API
     */
    public PlatformTokenResponse getTokenInfo() {
        PlatformStats stats = getOrCreateStats();

        BigDecimal change = stats.getTokenCurrentPrice().subtract(stats.getTokenBasePrice());
        double changePercent = 0;
        if (stats.getTokenBasePrice().compareTo(BigDecimal.ZERO) > 0) {
            changePercent = change
                    .divide(stats.getTokenBasePrice(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
        }

        BigDecimal marketCap = stats.getTokenCurrentPrice()
                .multiply(BigDecimal.valueOf(stats.getTokenTotalSupply()));

        return PlatformTokenResponse.builder()
                .ticker(TOKEN_TICKER)
                .name(TOKEN_NAME)
                .currentPrice(stats.getTokenCurrentPrice())
                .basePrice(stats.getTokenBasePrice())
                .change(change)
                .changePercent(Math.round(changePercent * 100.0) / 100.0)
                .totalSupply(stats.getTokenTotalSupply())
                .marketCap(marketCap)
                .totalFeesCollected(stats.getTotalFeesCollected())
                .dailyFees(stats.getDailyFees())
                .totalTradesCount(stats.getTotalTradesCount())
                .totalTradingVolume(stats.getTotalTradingVolume())
                .feeRate(FEE_RATE.multiply(BigDecimal.valueOf(100)).doubleValue()) // 0.15%
                .build();
    }

    /**
     * Mỗi 10 giây: broadcast giá token qua WebSocket (nếu cần)
     */
    @Scheduled(fixedRate = 10000)
    public void broadcastTokenPrice() {
        // Có thể mở rộng để broadcast qua WebSocket
        // Hiện tại chỉ ensure stats tồn tại
        getOrCreateStats();
    }
}

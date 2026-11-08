package com.stocklab.service.bot.manipulation.engine;

import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.PortfolioRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class BotFundManager {

    private final UserRepository userRepository;
    private final PortfolioRepository portfolioRepository;

    public static final int BOT_COUNT = 20;
    public static final String BOT_PREFIX = "bot_";

    public List<String> getAllBotUsernames() {
        List<String> list = new ArrayList<>();
        for (int i = 1; i <= BOT_COUNT; i++) {
            list.add(String.format("%s%02d", BOT_PREFIX, i));
        }
        return list;
    }

    /**
     * Chọn bot có số dư tiền mặt tốt nhất để thực hiện lệnh MUA
     */
    public Optional<String> selectBestBuyer(BigDecimal requiredCash) {
        List<String> botNames = getAllBotUsernames();
        List<User> eligibleBuyers = new ArrayList<>();

        for (String name : botNames) {
            userRepository.findByUsername(name).ifPresent(user -> {
                if (user.getBalance() != null && user.getBalance().compareTo(requiredCash) >= 0) {
                    eligibleBuyers.add(user);
                }
            });
        }

        if (eligibleBuyers.isEmpty()) {
            // Fallback: Tìm bot có số dư lớn nhất hiện có
            return botNames.stream()
                    .map(userRepository::findByUsername)
                    .filter(Optional::isPresent)
                    .map(Optional::get)
                    .max(Comparator.comparing(User::getBalance))
                    .map(User::getUsername);
        }

        // Sắp xếp giảm dần theo số dư, chọn ngẫu nhiên trong top 3 để tránh chỉ 1 bot giao dịch
        eligibleBuyers.sort((a, b) -> b.getBalance().compareTo(a.getBalance()));
        int pickIndex = new Random().nextInt(Math.min(3, eligibleBuyers.size()));
        return Optional.of(eligibleBuyers.get(pickIndex).getUsername());
    }

    /**
     * Chọn bot có số lượng cổ phiếu khả dụng tốt nhất để thực hiện lệnh BÁN
     */
    public Optional<String> selectBestSeller(String ticker, int requiredQty) {
        List<String> botNames = getAllBotUsernames();
        List<Map.Entry<String, Integer>> eligibleSellers = new ArrayList<>();

        for (String name : botNames) {
            Optional<User> userOpt = userRepository.findByUsername(name);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                Optional<Portfolio> pOpt = portfolioRepository.findByUserIdAndStockTicker(user.getId(), ticker);
                if (pOpt.isPresent()) {
                    int available = pOpt.get().getAvailableQuantity();
                    if (available >= requiredQty) {
                        eligibleSellers.add(Map.entry(name, available));
                    }
                }
            }
        }

        if (eligibleSellers.isEmpty()) {
            // Fallback: tìm bot nắm giữ nhiều nhất mã này (kể cả ít hơn requiredQty)
            return botNames.stream()
                    .map(userRepository::findByUsername)
                    .filter(Optional::isPresent)
                    .map(Optional::get)
                    .map(u -> {
                        int qty = portfolioRepository.findByUserIdAndStockTicker(u.getId(), ticker)
                                .map(Portfolio::getAvailableQuantity).orElse(0);
                        return Map.entry(u.getUsername(), qty);
                    })
                    .filter(entry -> entry.getValue() > 0)
                    .max(Comparator.comparingInt(Map.Entry::getValue))
                    .map(Map.Entry::getKey);
        }

        // Chọn ngẫu nhiên trong top 3 bot có nhiều CP nhất
        eligibleSellers.sort((a, b) -> Integer.compare(b.getValue(), a.getValue()));
        int pickIndex = new Random().nextInt(Math.min(3, eligibleSellers.size()));
        return Optional.of(eligibleSellers.get(pickIndex).getKey());
    }

    /**
     * Thuật toán phân bổ/chia nhỏ lệnh mua (Order Splitting) cho nhiều bot
     */
    public List<BotOrderSlice> splitBuyOrder(int totalQuantity, BigDecimal price) {
        List<BotOrderSlice> slices = new ArrayList<>();
        if (totalQuantity <= 0 || price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
            return slices;
        }

        int remainingQty = totalQuantity;
        List<String> botNames = getAllBotUsernames();
        Collections.shuffle(botNames);

        for (String bot : botNames) {
            if (remainingQty <= 0) break;

            Optional<User> uOpt = userRepository.findByUsername(bot);
            if (uOpt.isEmpty()) continue;

            User u = uOpt.get();
            BigDecimal balance = u.getBalance() != null ? u.getBalance() : BigDecimal.ZERO;
            int maxCanBuy = balance.divide(price, 0, java.math.RoundingMode.FLOOR).intValue();
            maxCanBuy = (maxCanBuy / 100) * 100; // Quy cách lô chẵn 100

            if (maxCanBuy > 0) {
                int buyQty = Math.min(remainingQty, maxCanBuy);
                if (buyQty >= 100) {
                    slices.add(new BotOrderSlice(bot, buyQty, price));
                    remainingQty -= buyQty;
                }
            }
        }
        return slices;
    }

    /**
     * Thuật toán phân bổ/chia nhỏ lệnh bán (Order Splitting) cho nhiều bot
     */
    public List<BotOrderSlice> splitSellOrder(String ticker, int totalQuantity, BigDecimal price) {
        List<BotOrderSlice> slices = new ArrayList<>();
        if (totalQuantity <= 0) {
            return slices;
        }

        int remainingQty = totalQuantity;
        List<String> botNames = getAllBotUsernames();
        Collections.shuffle(botNames);

        for (String bot : botNames) {
            if (remainingQty <= 0) break;

            Optional<User> uOpt = userRepository.findByUsername(bot);
            if (uOpt.isEmpty()) continue;

            User u = uOpt.get();
            int available = portfolioRepository.findByUserIdAndStockTicker(u.getId(), ticker)
                    .map(Portfolio::getAvailableQuantity)
                    .orElse(0);
            available = (available / 100) * 100; // Lô chẵn 100

            if (available > 0) {
                int sellQty = Math.min(remainingQty, available);
                if (sellQty >= 100) {
                    slices.add(new BotOrderSlice(bot, sellQty, price));
                    remainingQty -= sellQty;
                }
            }
        }
        return slices;
    }

    public record BotOrderSlice(String botUsername, int quantity, BigDecimal price) {}
}

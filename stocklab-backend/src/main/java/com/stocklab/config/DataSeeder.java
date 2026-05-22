package com.stocklab.config;

import com.stocklab.model.Role;
import com.stocklab.model.Stock;
import com.stocklab.model.StockPriceHistory;
import com.stocklab.model.User;
import com.stocklab.model.Portfolio;
import com.stocklab.model.Watchlist;
import com.stocklab.repository.StockPriceHistoryRepository;
import com.stocklab.repository.StockRepository;
import com.stocklab.repository.UserRepository;
import com.stocklab.repository.PortfolioRepository;
import com.stocklab.repository.WatchlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final StockRepository stockRepository;
    private final StockPriceHistoryRepository priceHistoryRepository;
    private final UserRepository userRepository;
    private final PortfolioRepository portfolioRepository;
    private final WatchlistRepository watchlistRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        seedAdminUser();
        unlockAllExistingUsers();

        seedUsers();
        unlockAllExistingUsers();
        seedStocks();
        seedPlatformToken();
        unlockAllExistingStocks();
        seedBotUser(); // [BOT-1] Module 6
        seedPortfolios();
        seedWatchlists();
        resetCorruptedPrices(); // Fix giá bị crash do bot
    }

    private void seedUsers() {
        // Check nếu đã có regular users (không đếm admin vì seedAdminUser chạy trước)
        if (userRepository.existsByUsername("user1")) {
            log.info("👤 Database đã có regular users, bỏ qua seeding user.");
            return;
        }

        log.info("🌱 Bắt đầu seed dữ liệu user...");

        // 1 Manager
        User manager = User.builder()
                .username("manager")
                .email("manager@stocklab.vn")
                .password(passwordEncoder.encode("manager123"))
                .fullName("Manager StockLab")
                .phone("0901000002")
                .role(Role.MANAGER)
                .balance(new BigDecimal("50000000.00"))
                .build();
        userRepository.save(manager);
        log.info("  ✅ Manager: {} ({})", manager.getUsername(), manager.getEmail());

        // 3 Regular Users
        for (int i = 1; i <= 3; i++) {
            User user = User.builder()
                    .username("user" + i)
                    .email("user" + i + "@stocklab.vn")
                    .password(passwordEncoder.encode("user123"))
                    .fullName("Người dùng " + i)
                    .phone("090100000" + (i + 2))
                    .role(Role.USER)
                    .balance(new BigDecimal("10000000.00"))
                    .build();
            userRepository.save(user);
            log.info("  ✅ User: {} ({})", user.getUsername(), user.getEmail());
        }

        log.info("🎉 Seed user hoàn tất! Đã tạo 5 tài khoản.");

        // [BOT-1] Seed Bot User (SEC-6 / Module 6)
        seedBotUser();
    }

    private void seedBotUser() {
        int BOT_COUNT = 20;
        List<Stock> allStocks = stockRepository.findAll();

        for (int i = 1; i <= BOT_COUNT; i++) {
            String botName = String.format("bot_%02d", i);
            if (!userRepository.existsByUsername(botName)) {
                User bot = User.builder()
                        .username(botName)
                        .email(botName + "@stocklab.bot")
                        .fullName("Trading Bot #" + i)
                        .password(passwordEncoder.encode("Bot@123"))
                        .role(Role.USER)
                        .balance(new BigDecimal("500000000.00")) // 500M mỗi bot
                        .isActive(true)
                        .build();
                userRepository.save(bot);
                log.info("🤖 Đã tạo {}", botName);
            }

            // Đảm bảo mỗi bot có portfolio cho tất cả CP
            User botUser = userRepository.findByUsername(botName).orElse(null);
            if (botUser != null) {
                for (Stock stock : allStocks) {
                    boolean has = portfolioRepository.findByUserIdAndStockId(botUser.getId(), stock.getId()).isPresent();
                    if (!has) {
                        Portfolio portfolio = Portfolio.builder()
                                .user(botUser)
                                .stock(stock)
                                .quantity(5000) // 5,000 CP mỗi mã
                                .lockedQuantity(0)
                                .avgBuyPrice(stock.getCurrentPrice())
                                .build();
                        portfolioRepository.save(portfolio);
                    }
                }
            }
        }

        // Giữ bot_liquidity cũ nếu có (backward compat)
        if (!userRepository.existsByUsername("bot_liquidity")) {
            User bot = User.builder()
                    .username("bot_liquidity")
                    .email("bot@stocklab.com")
                    .fullName("Liquidity Bot")
                    .password(passwordEncoder.encode("Bot@123"))
                    .role(Role.USER) // Role USER để có thể đặt lệnh bình thường
                    .balance(new BigDecimal("1000000000.00")) // 1 Tỷ VND để tạo thanh khoản
                    .isActive(true)
                    .build();
            userRepository.save(bot);
            log.info("🤖 Đã tạo Bot User: bot_liquidity (1,000,000,000 VND)");
        }

        log.info("🤖 {} Trading Bots đã sẵn sàng với portfolio cho {} mã CP", BOT_COUNT, allStocks.size());
    }

    private void seedStocks() {
        if (stockRepository.count() > 0) {
            log.info("📊 Database đã có dữ liệu cổ phiếu, bỏ qua seeding.");
            return;
        }

        log.info("🌱 Bắt đầu seed dữ liệu cổ phiếu...");

        List<StockSeedData> seedData = List.of(
                new StockSeedData("VNM", "Vinamilk", "HOSE", 78000),
                new StockSeedData("VIC", "Vingroup", "HOSE", 42000),
                new StockSeedData("FPT", "FPT Corporation", "HOSE", 125000),
                new StockSeedData("HPG", "Hòa Phát Group", "HOSE", 26000),
                new StockSeedData("MWG", "Thế Giới Di Động", "HOSE", 52000),
                new StockSeedData("VCB", "Vietcombank", "HOSE", 92000),
                new StockSeedData("BID", "BIDV", "HOSE", 47000),
                new StockSeedData("CTG", "VietinBank", "HOSE", 35000),
                new StockSeedData("TCB", "Techcombank", "HOSE", 38000),
                new StockSeedData("MBB", "MB Bank", "HOSE", 24000),
                new StockSeedData("VPB", "VPBank", "HOSE", 19000),
                new StockSeedData("VHM", "Vinhomes", "HOSE", 40000),
                new StockSeedData("MSN", "Masan Group", "HOSE", 82000),
                new StockSeedData("GAS", "PV Gas", "HOSE", 75000),
                new StockSeedData("VRE", "Vincom Retail", "HOSE", 23000),
                new StockSeedData("SSI", "SSI Securities", "HOSE", 32000),
                new StockSeedData("VND", "VNDirect", "HOSE", 18000),
                new StockSeedData("ACB", "ACB Bank", "HNX", 25000),
                new StockSeedData("SHB", "SHB Bank", "HNX", 12000),
                new StockSeedData("PVS", "PV Shipyard", "HNX", 28000)
        );

        Random random = new Random(42); // Fixed seed for reproducible data

        for (StockSeedData data : seedData) {
            Stock stock = createStock(data, random);
            stockRepository.save(stock);

            List<StockPriceHistory> history = generatePriceHistory(stock, data.basePrice, random);
            priceHistoryRepository.saveAll(history);

            log.info("  ✅ {} — {} ({}đ, {} ngày lịch sử)",
                    stock.getTicker(), stock.getCompanyName(),
                    stock.getCurrentPrice(), history.size());
        }

        log.info("🎉 Seed cổ phiếu hoàn tất! Đã tạo {} cổ phiếu.", seedData.size());

        // [BOT-1] Cấp chứng khoán cho Bot để có thể BÁN
        seedBotPortfolio();
    }

    private void seedPlatformToken() {
        if (!stockRepository.existsByTicker("SLP")) {
            Stock slp = new Stock();
            slp.setTicker("SLP");
            slp.setCompanyName("StockLab Platform Token");
            slp.setExchange("STOCKLAB");
            
            BigDecimal initialPrice = new BigDecimal("10000");
            slp.setReferencePrice(initialPrice);
            slp.setCurrentPrice(initialPrice);
            slp.setOpenPrice(initialPrice);
            slp.setHighPrice(initialPrice);
            slp.setLowPrice(initialPrice);
            slp.setChange(BigDecimal.ZERO);
            slp.setChangePercent(0.0);
            slp.setVolume(1000000L);
            slp.setActive(true);
            
            stockRepository.save(slp);
            log.info("💎 Đã tự động khởi tạo Mã Giao Dịch SLP trên sàn!");
        }
    }

    private void seedBotPortfolio() {
        User bot = userRepository.findByUsername("bot_liquidity").orElse(null);
        if (bot == null) return;

        if (portfolioRepository.existsByUserId(bot.getId())) {
            return;
        }

        List<Stock> stocks = stockRepository.findAll();
        for (Stock stock : stocks) {
            Portfolio p = Portfolio.builder()
                    .user(bot)
                    .stock(stock)
                    .quantity(10000) // Cấp mỗi mã 10k cổ phiếu cho Bot
                    .lockedQuantity(0)
                    .avgBuyPrice(stock.getReferencePrice())
                    .build();
            portfolioRepository.save(p);
        }
        log.info("🤖 Đã cấp danh mục đầu tư ban đầu cho bot_liquidity (10k CP mỗi mã)");
    }

    private Stock createStock(StockSeedData data, Random random) {
        double basePrice = data.basePrice;

        // Simulate today's trading
        double openPrice = basePrice * (1 + (random.nextDouble() - 0.5) * 0.02);
        double currentPrice = openPrice * (1 + (random.nextDouble() - 0.5) * 0.04);
        double highPrice = Math.max(openPrice, currentPrice) * (1 + random.nextDouble() * 0.015);
        double lowPrice = Math.min(openPrice, currentPrice) * (1 - random.nextDouble() * 0.015);
        double referencePrice = basePrice;
        double change = currentPrice - referencePrice;
        double changePercent = (change / referencePrice) * 100;
        long volume = (long) (random.nextDouble() * 5_000_000 + 500_000);

        return Stock.builder()
                .ticker(data.ticker)
                .companyName(data.companyName)
                .exchange(data.exchange)
                .currentPrice(toBigDecimal(currentPrice))
                .openPrice(toBigDecimal(openPrice))
                .highPrice(toBigDecimal(highPrice))
                .lowPrice(toBigDecimal(lowPrice))
                .referencePrice(toBigDecimal(referencePrice))
                .volume(volume)
                .change(toBigDecimal(change))
                .changePercent(Math.round(changePercent * 100.0) / 100.0)
                .build();
    }

    private List<StockPriceHistory> generatePriceHistory(Stock stock, double basePrice, Random random) {
        List<StockPriceHistory> history = new ArrayList<>();
        LocalDate today = LocalDate.now();
        double price = basePrice * 0.85; // Start 15% lower 90 days ago

        for (int i = 90; i >= 1; i--) {
            LocalDate date = today.minusDays(i);

            // Skip weekends
            if (date.getDayOfWeek().getValue() >= 6) continue;

            // Random daily variation (-3% to +3%)
            double dailyChange = (random.nextDouble() - 0.48) * 0.06; // Slight upward bias
            price = price * (1 + dailyChange);

            // Ensure price stays reasonable (±40% from base)
            price = Math.max(basePrice * 0.6, Math.min(basePrice * 1.4, price));

            double open = price * (1 + (random.nextDouble() - 0.5) * 0.02);
            double close = price;
            double high = Math.max(open, close) * (1 + random.nextDouble() * 0.015);
            double low = Math.min(open, close) * (1 - random.nextDouble() * 0.015);
            long vol = (long) (random.nextDouble() * 3_000_000 + 200_000);

            history.add(StockPriceHistory.builder()
                    .stock(stock)
                    .openPrice(toBigDecimal(open))
                    .highPrice(toBigDecimal(high))
                    .lowPrice(toBigDecimal(low))
                    .closePrice(toBigDecimal(close))
                    .volume(vol)
                    .tradingDate(date)
                    .build());
        }

        return history;
    }

    private BigDecimal toBigDecimal(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private void seedAdminUser() {
        if (!userRepository.existsByUsername("admin")) {
            User admin = User.builder()
                    .username("admin")
                    .email("admin@stocklab.com")
                    .fullName("System Admin")
                    .password(passwordEncoder.encode("Admin@123"))
                    .role(Role.ADMIN)
                    .balance(new BigDecimal("100000000.00")) // 100M VND
                    .is2faEnabled(true) // Bật 2FA cho admin để test
                    .twoFaSecret("CFJRTQYPKCVOHBQOTXTFHI7UC455AMM4") // Secret cố định cho JMeter
                    .isActive(true)
                    .build();
            userRepository.save(admin);
            log.info("👤 Đã tạo tài khoản admin mặc định (admin / Admin@123)");
        } else {
            // Đảm bảo admin luôn có twoFaSecret cố định cho JMeter test
            User admin = userRepository.findByUsername("admin").orElse(null);
            if (admin != null && (admin.getTwoFaSecret() == null || !admin.getTwoFaSecret().equals("CFJRTQYPKCVOHBQOTXTFHI7UC455AMM4"))) {
                admin.setTwoFaSecret("CFJRTQYPKCVOHBQOTXTFHI7UC455AMM4");
                userRepository.save(admin);
                log.info("🔑 Đã cập nhật twoFaSecret cho admin (khớp JMeter test).");
            }
        }
    }

    private void unlockAllExistingUsers() {
        String FIXED_SECRET = "CFJRTQYPKCVOHBQOTXTFHI7UC455AMM4";
        List<User> users = userRepository.findAll();
        boolean changed = false;
        for (User u : users) {
            if (!u.isActive()) {
                u.setActive(true);
                changed = true;
            }
            // Đảm bảo tất cả user có twoFaSecret cố định cho JMeter test
            if (u.getTwoFaSecret() == null || !u.getTwoFaSecret().equals(FIXED_SECRET)) {
                u.setTwoFaSecret(FIXED_SECRET);
                changed = true;
            }
        }
        if (changed) {
            userRepository.saveAll(users);
            log.info("🔓 Đã đồng bộ isActive + twoFaSecret cho tất cả tài khoản.");
        }
    }

    private void unlockAllExistingStocks() {
        List<Stock> stocks = stockRepository.findAll();
        boolean changed = false;
        for (Stock s : stocks) {
            if (!s.isActive()) {
                s.setActive(true);
                changed = true;
            }
        }
        if (changed) {
            stockRepository.saveAll(stocks);
            log.info("🔓 Đã tự động mở khoá (isActive = true) cho các mã cổ phiếu cũ do cập nhật cấu trúc Database.");
        }
    }

    /**
     * Phát hiện và sửa giá cổ phiếu bị crash do bot (currentPrice < 50% referencePrice).
     * Reset lại currentPrice, openPrice, highPrice, lowPrice về quanh referencePrice.
     */
    private void resetCorruptedPrices() {
        List<Stock> stocks = stockRepository.findAll();
        Random random = new Random();
        int fixedCount = 0;

        for (Stock stock : stocks) {
            BigDecimal refPrice = stock.getReferencePrice();
            if (refPrice == null || refPrice.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal currentPrice = stock.getCurrentPrice();
            // Phát hiện giá crash: currentPrice < 50% hoặc > 200% so với referencePrice
            BigDecimal threshold = refPrice.multiply(BigDecimal.valueOf(0.5));
            BigDecimal upperThreshold = refPrice.multiply(BigDecimal.valueOf(2.0));

            if (currentPrice.compareTo(threshold) < 0 || currentPrice.compareTo(upperThreshold) > 0) {
                // Reset giá về quanh referencePrice (±2%)
                double variation = (random.nextDouble() - 0.5) * 0.04;
                BigDecimal newPrice = refPrice.multiply(BigDecimal.valueOf(1 + variation))
                        .setScale(2, RoundingMode.HALF_UP);
                double openVar = (random.nextDouble() - 0.5) * 0.02;
                BigDecimal newOpen = refPrice.multiply(BigDecimal.valueOf(1 + openVar))
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal newHigh = newPrice.max(newOpen).multiply(BigDecimal.valueOf(1.01))
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal newLow = newPrice.min(newOpen).multiply(BigDecimal.valueOf(0.99))
                        .setScale(2, RoundingMode.HALF_UP);

                stock.setCurrentPrice(newPrice);
                stock.setOpenPrice(newOpen);
                stock.setHighPrice(newHigh);
                stock.setLowPrice(newLow);
                stock.setChange(newPrice.subtract(refPrice));
                stock.setChangePercent(
                    newPrice.subtract(refPrice)
                            .divide(refPrice, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            .doubleValue()
                );
                stock.setVolume((long) (random.nextDouble() * 3_000_000 + 500_000));
                stockRepository.save(stock);
                fixedCount++;
                log.warn("🔧 Reset giá {} từ {} về {} (ref={})",
                        stock.getTicker(), currentPrice, newPrice, refPrice);
            }
        }

        if (fixedCount > 0) {
            log.info("🔧 Đã reset giá cho {} mã cổ phiếu bị crash do bot.", fixedCount);
        }
    }

    // ===== [BOT-1] Trading Bot User =====

    private void seedPortfolios() {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> (u.getRole() == Role.USER || u.getRole() == Role.MANAGER)
                        && !u.getUsername().startsWith("bot_"))
                .toList();
        List<Stock> stocks = stockRepository.findAll();

        if (users.isEmpty() || stocks.isEmpty()) {
            log.warn("⚠️ Không có user hoặc stock để seed portfolio.");
            return;
        }

        // Kiểm tra xem user thường đã có portfolio chưa
        boolean alreadySeeded = users.stream()
                .anyMatch(u -> !portfolioRepository.findByUserId(u.getId()).isEmpty());
        if (alreadySeeded) {
            log.info("💼 Regular users đã có portfolio, bỏ qua seeding.");
            return;
        }

        log.info("🌱 Bắt đầu seed dữ liệu portfolio cho {} users...", users.size());


        Random random = new Random(99);
        int count = 0;

        // Mỗi user sở hữu ít nhất 10 loại CP (10-14 mã)
        for (User user : users) {
            // Bỏ qua bot users (đã seed portfolio riêng)
            if (user.getUsername().startsWith("bot_")) continue;

            int numStocks = 10 + random.nextInt(5); // 10-14 stocks
            List<Stock> shuffled = new ArrayList<>(stocks);
            java.util.Collections.shuffle(shuffled, random);

            for (int i = 0; i < Math.min(numStocks, shuffled.size()); i++) {
                Stock stock = shuffled.get(i);
                int qty = (random.nextInt(30) + 5) * 10; // 50-300 CP (bội 10)
                double avgPrice = stock.getCurrentPrice().doubleValue() * (0.85 + random.nextDouble() * 0.2); // 85%-105% giá hiện tại

                Portfolio portfolio = Portfolio.builder()
                        .user(user)
                        .stock(stock)
                        .quantity(qty)
                        .lockedQuantity(0)
                        .avgBuyPrice(toBigDecimal(avgPrice))
                        .build();
                portfolioRepository.save(portfolio);
                count++;
            }
        }

        log.info("🎉 Seed portfolio hoàn tất! Đã tạo {} bản ghi.", count);
    }

    private void seedWatchlists() {
        if (watchlistRepository.count() > 0) {
            log.info("⭐ Database đã có dữ liệu watchlist, bỏ qua seeding.");
            return;
        }

        log.info("🌱 Bắt đầu seed dữ liệu watchlist...");

        List<User> users = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.USER || u.getRole() == Role.MANAGER)
                .toList();
        List<Stock> stocks = stockRepository.findAll();

        if (users.isEmpty() || stocks.isEmpty()) {
            log.warn("⚠️ Không có user hoặc stock để seed watchlist.");
            return;
        }

        Random random = new Random(77);
        int count = 0;

        // Mỗi user theo dõi 4-6 CP
        for (User user : users) {
            int numStocks = 4 + random.nextInt(3); // 4-6 stocks
            List<Stock> shuffled = new ArrayList<>(stocks);
            java.util.Collections.shuffle(shuffled, random);

            for (int i = 0; i < Math.min(numStocks, shuffled.size()); i++) {
                Watchlist watchlist = Watchlist.builder()
                        .user(user)
                        .stock(shuffled.get(i))
                        .build();
                watchlistRepository.save(watchlist);
                count++;
            }
        }

        log.info("🎉 Seed watchlist hoàn tất! Đã tạo {} bản ghi.", count);
    }

    private record StockSeedData(String ticker, String companyName, String exchange, double basePrice) {}
}

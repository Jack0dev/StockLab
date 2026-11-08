package com.stocklab.service;

import com.stocklab.presentation.dto.*;
import com.stocklab.domain.model.CustomPortfolio;
import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.CustomPortfolioRepository;
import com.stocklab.infrastructure.repository.PortfolioRepository;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocklab.service.order.PortfolioMetricsCalculator;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomPortfolioService {

    private static final int MAX_PORTFOLIOS_PER_USER = 10;

    private final CustomPortfolioRepository customPortfolioRepository;
    private final UserRepository userRepository;
    private final StockRepository stockRepository;
    private final PortfolioRepository portfolioRepository;
    private final PortfolioMetricsCalculator portfolioMetricsCalculator;

    @Transactional(readOnly = true)
    public ApiResponse<List<CustomPortfolioDTO>> getCustomPortfolios(String username) {
        User user = getUserByUsername(username);
        List<CustomPortfolio> portfolios = customPortfolioRepository.findByUserIdWithStocks(user.getId());
        List<CustomPortfolioDTO> dtos = portfolios.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return ApiResponse.success("Lấy danh sách danh mục thành công", dtos);
    }

    @Transactional
    public ApiResponse<CustomPortfolioDTO> createCustomPortfolio(String username, CreateCustomPortfolioRequest req) {
        User user = getUserByUsername(username);

        long count = customPortfolioRepository.countByUserId(user.getId());
        if (count >= MAX_PORTFOLIOS_PER_USER) {
            return ApiResponse.error("Bạn chỉ có thể tạo tối đa " + MAX_PORTFOLIOS_PER_USER + " danh mục đầu tư");
        }

        String name = req.getName().trim();
        if (customPortfolioRepository.existsByUserIdAndName(user.getId(), name)) {
            return ApiResponse.error("Bạn đã có danh mục mang tên '" + name + "'");
        }

        Set<Stock> stocks = new HashSet<>();
        if (req.getTickers() != null && !req.getTickers().isEmpty()) {
            List<String> tickers = req.getTickers().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .map(String::toUpperCase)
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .collect(Collectors.toList());
            if (!tickers.isEmpty()) {
                stocks.addAll(stockRepository.findByTickerIn(tickers));
            }
        }

        CustomPortfolio customPortfolio = CustomPortfolio.builder()
                .user(user)
                .name(name)
                .description(req.getDescription() != null ? req.getDescription().trim() : null)
                .stocks(stocks)
                .build();

        customPortfolio = customPortfolioRepository.save(customPortfolio);
        return ApiResponse.success("Tạo danh mục đầu tư thành công", toDTO(customPortfolio));
    }

    @Transactional
    public ApiResponse<CustomPortfolioDTO> updateCustomPortfolio(String username, Long portfolioId, UpdateCustomPortfolioRequest req) {
        User user = getUserByUsername(username);
        CustomPortfolio portfolio = customPortfolioRepository.findByIdAndUserIdWithStocks(portfolioId, user.getId())
                .orElse(null);
        if (portfolio == null) {
            return ApiResponse.error("Không tìm thấy danh mục đầu tư");
        }

        String name = req.getName().trim();
        if (customPortfolioRepository.existsByUserIdAndNameAndIdNot(user.getId(), name, portfolioId)) {
            return ApiResponse.error("Bạn đã có danh mục khác mang tên '" + name + "'");
        }

        portfolio.setName(name);
        portfolio.setDescription(req.getDescription() != null ? req.getDescription().trim() : null);

        portfolio = customPortfolioRepository.save(portfolio);
        return ApiResponse.success("Cập nhật danh mục thành công", toDTO(portfolio));
    }

    @Transactional
    public ApiResponse<Void> deleteCustomPortfolio(String username, Long portfolioId) {
        User user = getUserByUsername(username);
        CustomPortfolio portfolio = customPortfolioRepository.findByIdAndUserId(portfolioId, user.getId())
                .orElse(null);
        if (portfolio == null) {
            return ApiResponse.error("Không tìm thấy danh mục đầu tư");
        }

        customPortfolioRepository.delete(portfolio);
        return ApiResponse.success("Xóa danh mục đầu tư thành công", null);
    }

    @Transactional
    public ApiResponse<CustomPortfolioDTO> updatePortfolioStocks(String username, Long portfolioId, UpdatePortfolioStocksRequest req) {
        User user = getUserByUsername(username);
        CustomPortfolio portfolio = customPortfolioRepository.findByIdAndUserIdWithStocks(portfolioId, user.getId())
                .orElse(null);
        if (portfolio == null) {
            return ApiResponse.error("Không tìm thấy danh mục đầu tư");
        }

        Set<Stock> stocks = new HashSet<>();
        if (req.getTickers() != null && !req.getTickers().isEmpty()) {
            List<String> tickers = req.getTickers().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .map(String::toUpperCase)
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .collect(Collectors.toList());
            if (!tickers.isEmpty()) {
                stocks.addAll(stockRepository.findByTickerIn(tickers));
            }
        }

        portfolio.setStocks(stocks);
        portfolio = customPortfolioRepository.save(portfolio);
        return ApiResponse.success("Cập nhật danh sách cổ phiếu trong danh mục thành công", toDTO(portfolio));
    }

    @Transactional(readOnly = true)
    public ApiResponse<CustomPortfolioSummaryResponse> getCustomPortfolioSummary(String username, Long portfolioId) {
        User user = getUserByUsername(username);
        CustomPortfolio customPortfolio = customPortfolioRepository.findByIdAndUserIdWithStocks(portfolioId, user.getId())
                .orElse(null);
        if (customPortfolio == null) {
            return ApiResponse.error("Không tìm thấy danh mục đầu tư");
        }

        Set<Long> stockIdsInCustom = customPortfolio.getStocks().stream()
                .map(Stock::getId)
                .collect(Collectors.toSet());

        List<Portfolio> allUserHoldings = portfolioRepository.findByUserId(user.getId());
        List<Portfolio> matchedHoldings = allUserHoldings.stream()
                .filter(p -> p.getQuantity() != null && p.getQuantity() > 0)
                .filter(p -> p.getStock() != null && stockIdsInCustom.contains(p.getStock().getId()))
                .collect(Collectors.toList());

        PortfolioMetricsCalculator.CalculationResult result = portfolioMetricsCalculator.calculate(matchedHoldings, BigDecimal.ZERO);

        List<PortfolioResponse> holdingsResponses = matchedHoldings.stream()
                .map(this::toPortfolioResponse)
                .collect(Collectors.toList());

        CustomPortfolioSummaryResponse response = CustomPortfolioSummaryResponse.builder()
                .id(customPortfolio.getId())
                .name(customPortfolio.getName())
                .description(customPortfolio.getDescription())
                .totalStockValue(result.getTotalStockValue())
                .totalInvested(result.getTotalInvested())
                .totalPnL(result.getTotalPnL())
                .totalPnLPercent(result.getTotalPnLPercent())
                .holdings(holdingsResponses)
                .allocations(result.getAllocations())
                .build();

        return ApiResponse.success("Lấy thông tin danh mục thành công", response);
    }

    private User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng: " + username));
    }

    private CustomPortfolioDTO toDTO(CustomPortfolio cp) {
        List<String> tickers = cp.getStocks() != null
                ? cp.getStocks().stream().map(Stock::getTicker).sorted().collect(Collectors.toList())
                : Collections.emptyList();

        return CustomPortfolioDTO.builder()
                .id(cp.getId())
                .name(cp.getName())
                .description(cp.getDescription())
                .stockCount(tickers.size())
                .tickers(tickers)
                .createdAt(cp.getCreatedAt())
                .build();
    }

    private PortfolioResponse toPortfolioResponse(Portfolio p) {
        Stock stock = p.getStock();
        BigDecimal currentPrice = stock.getCurrentPrice() != null ? stock.getCurrentPrice() : BigDecimal.ZERO;
        BigDecimal totalValue = currentPrice.multiply(BigDecimal.valueOf(p.getQuantity()));
        BigDecimal profitLoss = currentPrice.subtract(p.getAvgBuyPrice())
                .multiply(BigDecimal.valueOf(p.getQuantity()));

        double profitLossPercent = 0.0;
        if (p.getAvgBuyPrice().compareTo(BigDecimal.ZERO) > 0) {
            profitLossPercent = currentPrice.subtract(p.getAvgBuyPrice())
                    .divide(p.getAvgBuyPrice(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
        }

        return PortfolioResponse.builder()
                .id(p.getId())
                .ticker(stock.getTicker())
                .companyName(stock.getCompanyName())
                .exchange(stock.getExchange())
                .quantity(p.getQuantity())
                .avgBuyPrice(p.getAvgBuyPrice())
                .currentPrice(currentPrice)
                .totalValue(totalValue)
                .profitLoss(profitLoss)
                .profitLossPercent(profitLossPercent)
                .build();
    }
}

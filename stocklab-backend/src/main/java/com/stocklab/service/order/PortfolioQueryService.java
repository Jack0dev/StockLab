package com.stocklab.service.order;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.PortfolioResponse;
import com.stocklab.presentation.dto.PortfolioSummaryResponse;
import com.stocklab.presentation.dto.TransactionResponse;
import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.Transaction;
import com.stocklab.domain.model.TransactionType;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.PortfolioRepository;
import com.stocklab.infrastructure.repository.TransactionRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PortfolioQueryService {

    private final UserRepository userRepository;
    private final PortfolioRepository portfolioRepository;
    private final TransactionRepository transactionRepository;
    private final PortfolioMetricsCalculator portfolioMetricsCalculator;

    /**
     * Lịch sử giao dịch
     */
    public ApiResponse<Page<TransactionResponse>> getTransactionHistory(
            String username, Pageable pageable, String type) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        Page<TransactionResponse> transactions;
        if (type != null && !type.isEmpty()) {
            try {
                TransactionType txType = TransactionType.valueOf(type.toUpperCase());
                transactions = transactionRepository
                        .findByUserIdAndTypeOrderByCreatedAtDesc(user.getId(), txType, pageable)
                        .map(OrderDtoMapper::toTransactionResponse);
            } catch (IllegalArgumentException e) {
                return ApiResponse.error("Loại giao dịch không hợp lệ: " + type);
            }
        } else {
            transactions = transactionRepository
                    .findByUserIdOrderByCreatedAtDesc(user.getId(), pageable)
                    .map(OrderDtoMapper::toTransactionResponse);
        }
        return ApiResponse.success("Lấy lịch sử giao dịch thành công", transactions);
    }

    /**
     * Danh mục đầu tư
     */
    @Transactional(readOnly = true)
    public ApiResponse<List<PortfolioResponse>> getPortfolio(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        List<PortfolioResponse> portfolio = portfolioRepository.findByUserId(user.getId())
                .stream()
                .map(OrderDtoMapper::toPortfolioResponse)
                .collect(Collectors.toList());

        return ApiResponse.success("Lấy danh mục đầu tư thành công", portfolio);
    }

    /**
     * Portfolio Summary (cho charts & metrics)
     */
    @Transactional(readOnly = true)
    public ApiResponse<PortfolioSummaryResponse> getPortfolioSummary(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        List<Portfolio> holdings = portfolioRepository.findByUserId(user.getId());
        BigDecimal cashBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;

        PortfolioMetricsCalculator.CalculationResult result = portfolioMetricsCalculator.calculate(holdings, cashBalance);

        PortfolioSummaryResponse summary = PortfolioSummaryResponse.builder()
                .totalAssets(result.getTotalAssets())
                .totalStockValue(result.getTotalStockValue())
                .totalInvested(result.getTotalInvested())
                .cashBalance(result.getCashBalance())
                .totalPnL(result.getTotalPnL())
                .totalPnLPercent(result.getTotalPnLPercent())
                .allocations(result.getAllocations())
                .build();

        return ApiResponse.success("Lấy tóm tắt danh mục thành công", summary);
    }
}

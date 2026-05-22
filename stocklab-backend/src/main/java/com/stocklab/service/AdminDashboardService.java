package com.stocklab.service;

import com.stocklab.dto.AdminDashboardResponse;
import com.stocklab.dto.TopStockDto;
import com.stocklab.repository.TransactionRepository;
import com.stocklab.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    public AdminDashboardResponse getDashboardStats() {
        long totalUsers = userRepository.count();
        long totalTransactions = transactionRepository.count();
        Long totalVolume = transactionRepository.getTotalVolume();
        BigDecimal totalRevenue = transactionRepository.getTotalRevenue();
        List<TopStockDto> topStocks = transactionRepository.getTopStocksByVolume(PageRequest.of(0, 5));

        if (totalVolume == null) totalVolume = 0L;
        if (totalRevenue == null) totalRevenue = BigDecimal.ZERO;

        return AdminDashboardResponse.builder()
                .totalUsers(totalUsers)
                .totalTransactions(totalTransactions)
                .totalVolume(totalVolume)
                .totalRevenue(totalRevenue)
                .topStocks(topStocks)
                .build();
    }
}

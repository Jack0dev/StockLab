package com.stocklab.infrastructure.repository;

import com.stocklab.domain.model.StockPriceHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface StockPriceHistoryRepository extends JpaRepository<StockPriceHistory, Long> {

    List<StockPriceHistory> findByStockTickerAndTradingDateBetweenOrderByTradingDateAsc(
            String ticker, LocalDate startDate, LocalDate endDate);

    List<StockPriceHistory> findByStockTickerOrderByTradingDateDesc(String ticker);

    void deleteByStockId(Long stockId);
}

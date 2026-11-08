package com.stocklab.infrastructure.repository;

import com.stocklab.domain.model.Stock;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StockRepository extends JpaRepository<Stock, Long> {

    Optional<Stock> findByTicker(String ticker);

    List<Stock> findByTickerIn(java.util.Collection<String> tickers);

    List<Stock> findByExchange(String exchange);

    Page<Stock> findByExchange(String exchange, Pageable pageable);

    @Query("SELECT s FROM Stock s WHERE LOWER(s.ticker) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(s.companyName) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<Stock> searchByKeyword(@Param("keyword") String keyword);

    boolean existsByTicker(String ticker);
}

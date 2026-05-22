package com.stocklab.repository;

import com.stocklab.dto.TopStockDto;
import com.stocklab.model.Transaction;
import com.stocklab.model.TransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    Page<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Page<Transaction> findByUserIdAndTypeOrderByCreatedAtDesc(Long userId, TransactionType type, Pageable pageable);

    @Query("SELECT SUM(t.quantity) FROM Transaction t")
    Long getTotalVolume();

    @Query("SELECT SUM(t.totalAmount) FROM Transaction t")
    BigDecimal getTotalRevenue();

    @Query("SELECT new com.stocklab.dto.TopStockDto(t.stock.ticker, SUM(t.quantity)) FROM Transaction t GROUP BY t.stock.ticker ORDER BY SUM(t.quantity) DESC")
    List<TopStockDto> getTopStocksByVolume(Pageable pageable);
}

package com.stocklab.repository;

import com.stocklab.model.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioRepository extends JpaRepository<Portfolio, Long> {

    List<Portfolio> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    Optional<Portfolio> findByUserIdAndStockId(Long userId, Long stockId);

    Optional<Portfolio> findByUserIdAndStockTicker(Long userId, String ticker);
}

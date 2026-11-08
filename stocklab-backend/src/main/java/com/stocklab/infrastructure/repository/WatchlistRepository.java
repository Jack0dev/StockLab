package com.stocklab.infrastructure.repository;

import com.stocklab.domain.model.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchlistRepository extends JpaRepository<Watchlist, Long> {

    List<Watchlist> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Watchlist> findByUserIdAndStockId(Long userId, Long stockId);

    boolean existsByUserIdAndStockTicker(Long userId, String ticker);
}

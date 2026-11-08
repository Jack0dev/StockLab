package com.stocklab.infrastructure.repository;

import com.stocklab.domain.model.PlatformStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlatformStatsRepository extends JpaRepository<PlatformStats, Long> {
}

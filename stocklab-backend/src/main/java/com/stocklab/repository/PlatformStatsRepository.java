package com.stocklab.repository;

import com.stocklab.model.PlatformStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlatformStatsRepository extends JpaRepository<PlatformStats, Long> {
}

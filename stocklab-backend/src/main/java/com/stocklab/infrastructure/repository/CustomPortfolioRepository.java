package com.stocklab.infrastructure.repository;

import com.stocklab.domain.model.CustomPortfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomPortfolioRepository extends JpaRepository<CustomPortfolio, Long> {

    @Query("SELECT cp FROM CustomPortfolio cp LEFT JOIN FETCH cp.stocks WHERE cp.user.id = :userId ORDER BY cp.createdAt ASC")
    List<CustomPortfolio> findByUserIdWithStocks(@Param("userId") Long userId);

    @Query("SELECT cp FROM CustomPortfolio cp LEFT JOIN FETCH cp.stocks WHERE cp.id = :id AND cp.user.id = :userId")
    Optional<CustomPortfolio> findByIdAndUserIdWithStocks(@Param("id") Long id, @Param("userId") Long userId);

    Optional<CustomPortfolio> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndName(Long userId, String name);

    boolean existsByUserIdAndNameAndIdNot(Long userId, String name, Long id);

    long countByUserId(Long userId);
}

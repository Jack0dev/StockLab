package com.stocklab.infrastructure.repository;

import com.stocklab.domain.model.NewsArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface NewsArticleRepository extends JpaRepository<NewsArticle, Long> {

    boolean existsByGuidHash(String guidHash);

    List<NewsArticle> findTop20ByOrderByPublishedAtDesc();

    Page<NewsArticle> findAllByOrderByPublishedAtDesc(Pageable pageable);

    @Query("SELECT n FROM NewsArticle n WHERE n.relatedTickers LIKE CONCAT('%', :ticker, '%') ORDER BY n.publishedAt DESC")
    List<NewsArticle> findByTicker(@Param("ticker") String ticker, Pageable pageable);

    @Query("SELECT n FROM NewsArticle n WHERE " +
           "(:source IS NULL OR LOWER(n.source) = LOWER(:source)) AND " +
           "(:ticker IS NULL OR n.relatedTickers LIKE CONCAT('%', :ticker, '%')) AND " +
           "(:query IS NULL OR LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(n.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY n.publishedAt DESC")
    Page<NewsArticle> filterNews(
            @Param("source") String source,
            @Param("ticker") String ticker,
            @Param("query") String query,
            Pageable pageable);

    @Query("SELECT COUNT(n) FROM NewsArticle n WHERE n.relatedTickers IS NOT NULL AND TRIM(n.relatedTickers) <> ''")
    long countArticlesWithTickers();

    Optional<NewsArticle> findTopByOrderByCreatedAtDesc();

    @Modifying
    @Transactional
    @Query("DELETE FROM NewsArticle n WHERE n.publishedAt < :cutoff")
    void deleteByPublishedAtBefore(@Param("cutoff") LocalDateTime cutoff);
}

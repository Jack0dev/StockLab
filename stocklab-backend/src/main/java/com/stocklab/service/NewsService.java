package com.stocklab.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.stocklab.domain.model.NewsArticle;
import com.stocklab.infrastructure.repository.NewsArticleRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * [P3-01] Financial News Service
 * Queries persistent news from MySQL news_articles table, populated by NewsCrawlerService.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NewsService {

    private final NewsArticleRepository newsArticleRepository;
    private final NewsCrawlerService newsCrawlerService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /**
     * Get latest general news.
     */
    public List<NewsItem> getLatestNews() {
        return getLatestNews(null);
    }

    /**
     * Get news with optional ticker filter.
     */
    public List<NewsItem> getLatestNews(String ticker) {
        List<NewsArticle> articles = new ArrayList<>();

        if (ticker != null && !ticker.isBlank()) {
            articles = newsArticleRepository.findByTicker(ticker.trim().toUpperCase(), PageRequest.of(0, 15));
        }

        // If no articles found for ticker or ticker is null, fallback to latest general news
        if (articles.isEmpty()) {
            articles = newsArticleRepository.findTop20ByOrderByPublishedAtDesc();
        }

        // If database is completely empty (first boot), trigger a crawl on the fly
        if (articles.isEmpty()) {
            log.info("[NewsService] Cơ sở dữ liệu tin tức đang trống, tiến hành cào tin tức...");
            newsCrawlerService.crawlNewsNow();
            articles = newsArticleRepository.findTop20ByOrderByPublishedAtDesc();
        }

        return articles.stream().map(this::toNewsItem).toList();
    }

    /**
     * Get paginated and filtered news for the main News Page and Admin management.
     */
    public org.springframework.data.domain.Page<NewsItem> getNewsPaged(String ticker, String source, String search, int page, int size) {
        String cleanTicker = (ticker != null && !ticker.isBlank()) ? ticker.trim().toUpperCase() : null;
        String cleanSource = (source != null && !source.isBlank() && !source.equalsIgnoreCase("all")) ? source.trim() : null;
        String cleanQuery = (search != null && !search.isBlank()) ? search.trim() : null;

        org.springframework.data.domain.Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 50)));
        org.springframework.data.domain.Page<NewsArticle> articlePage = newsArticleRepository.filterNews(cleanSource, cleanTicker, cleanQuery, pageable);

        // Fallback: If DB is empty on first query, trigger a crawl and re-query
        if (articlePage.isEmpty() && newsArticleRepository.count() == 0) {
            log.info("[NewsService] DB tin tức đang rỗng, tiến hành cào tin...");
            newsCrawlerService.crawlNewsNow();
            articlePage = newsArticleRepository.filterNews(cleanSource, cleanTicker, cleanQuery, pageable);
        }

        return articlePage.map(this::toNewsItem);
    }

    public void deleteArticle(Long id) {
        newsArticleRepository.deleteById(id);
    }

    private NewsItem toNewsItem(NewsArticle article) {
        NewsItem item = new NewsItem();
        item.setId(article.getId());
        item.setTitle(article.getTitle());
        item.setLink(article.getLink());
        item.setDescription(article.getDescription());
        item.setSource(article.getSource());
        item.setThumbnail(article.getThumbnailUrl());
        item.setRelatedTickers(article.getRelatedTickers());

        if (article.getPublishedAt() != null) {
            item.setPublishedAt(article.getPublishedAt().format(DATE_FORMATTER));
            item.setPubDate(article.getPublishedAt().toString());
        }
        return item;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NewsItem {
        private Long id;
        private String title;
        private String link;
        private String description;
        private String publishedAt;
        private String pubDate;
        private String source;
        private String thumbnail;
        private String relatedTickers;
    }
}

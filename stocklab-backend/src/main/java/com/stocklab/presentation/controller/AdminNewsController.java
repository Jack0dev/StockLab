package com.stocklab.presentation.controller;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.CrawlResultResponse;
import com.stocklab.infrastructure.repository.NewsArticleRepository;
import com.stocklab.service.NewsCrawlerService;
import com.stocklab.service.NewsService;
import com.stocklab.service.NewsService.NewsItem;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/news")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminNewsController {

    private final NewsCrawlerService newsCrawlerService;
    private final NewsService newsService;
    private final NewsArticleRepository newsArticleRepository;

    @PostMapping("/crawl-now")
    public ResponseEntity<ApiResponse<CrawlResultResponse>> crawlNow() {
        CrawlResultResponse result = newsCrawlerService.crawlNewsNow();
        return ResponseEntity.ok(ApiResponse.success("Thực hiện cào tin tức thành công", result));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStats() {
        long totalArticles = newsArticleRepository.count();
        long articlesWithTickers = newsArticleRepository.countArticlesWithTickers();
        CrawlResultResponse lastResult = newsCrawlerService.getCrawlStats();

        Map<String, Object> stats = Map.of(
            "totalArticles", totalArticles,
            "articlesWithTickers", articlesWithTickers,
            "configuredFeeds", 4,
            "crawlIntervalHours", 3,
            "activeSources", List.of("CafeF", "VnEconomy", "VnExpress", "Tuổi Trẻ"),
            "lastNewArticles", lastResult.getNewArticles(),
            "lastDuplicatesSkipped", lastResult.getDuplicatesSkipped(),
            "lastCrawlTime", lastResult.getLastCrawlTime() != null ? lastResult.getLastCrawlTime().toString() : ""
        );
        return ResponseEntity.ok(ApiResponse.success("Lấy thông tin crawler thành công", stats));
    }

    @GetMapping("/articles")
    public ResponseEntity<ApiResponse<Page<NewsItem>>> getArticles(
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "ticker", required = false) String ticker,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "15") int size) {
        Page<NewsItem> pagedNews = newsService.getNewsPaged(ticker, source, search, page, size);
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách bài viết quản trị thành công", pagedNews));
    }

    @DeleteMapping("/articles/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteArticle(@PathVariable Long id) {
        newsService.deleteArticle(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa bài viết thành công", null));
    }
}

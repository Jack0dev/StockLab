package com.stocklab.presentation.controller;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.service.NewsService;
import com.stocklab.service.NewsService.NewsItem;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * [P3-05] GET /api/news — financial news with ticker filter, search, and pagination.
 */
@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    @GetMapping
    public ResponseEntity<List<NewsItem>> getNews(@RequestParam(value = "ticker", required = false) String ticker) {
        List<NewsItem> news = newsService.getLatestNews(ticker);
        return ResponseEntity.ok(news);
    }

    @GetMapping("/paged")
    public ResponseEntity<ApiResponse<Page<NewsItem>>> getNewsPaged(
            @RequestParam(value = "ticker", required = false) String ticker,
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "12") int size) {
        Page<NewsItem> pagedNews = newsService.getNewsPaged(ticker, source, search, page, size);
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách tin tức thành công", pagedNews));
    }

    @GetMapping("/ticker/{ticker}")
    public ResponseEntity<List<NewsItem>> getNewsByTicker(@PathVariable String ticker) {
        List<NewsItem> news = newsService.getLatestNews(ticker);
        return ResponseEntity.ok(news);
    }
}

package com.stocklab.controller;

import com.stocklab.service.NewsService;
import com.stocklab.service.NewsService.NewsItem;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * [P3-05] GET /api/news — financial news from RSS feeds.
 */
@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    @GetMapping
    public ResponseEntity<List<NewsItem>> getLatestNews() {
        List<NewsItem> news = newsService.getLatestNews();
        return ResponseEntity.ok(news);
    }
}

package com.stocklab.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * [P3-01] Financial News Service
 * [P3-02] RSS Parser (VnEconomy)
 * [P3-04] Redis cache TTL=15min
 */
@Service
@Slf4j
public class NewsService {

    private final StringRedisTemplate redis;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private static final String NEWS_CACHE_KEY = "news:latest";
    private static final long NEWS_CACHE_TTL = 900; // 15 minutes

    // RSS feed URLs
    private static final List<String> RSS_FEEDS = List.of(
            "https://vneconomy.vn/chung-khoan.rss",
            "https://vnexpress.net/rss/kinh-doanh/chung-khoan.rss"
    );

    public NewsService(StringRedisTemplate redis) {
        this.redis = redis;
        this.objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Get latest news. Returns from Redis cache first, fetches fresh if expired.
     */
    public List<NewsItem> getLatestNews() {
        try {
            String cached = redis.opsForValue().get(NEWS_CACHE_KEY);
            if (cached != null) {
                return objectMapper.readValue(cached,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, NewsItem.class));
            }
        } catch (Exception e) {
            log.debug("Cache read failed: {}", e.getMessage());
        }

        // Fetch fresh
        List<NewsItem> news = fetchAllFeeds();
        cacheNews(news);
        return news;
    }

    /**
     * Fetch news from all RSS feeds.
     */
    private List<NewsItem> fetchAllFeeds() {
        List<NewsItem> allNews = new ArrayList<>();

        for (String feedUrl : RSS_FEEDS) {
            try {
                List<NewsItem> items = parseRssFeed(feedUrl);
                allNews.addAll(items);
            } catch (Exception e) {
                log.warn("Failed to fetch RSS {}: {}", feedUrl, e.getMessage());
            }
        }

        // Sort by date desc, take top 20
        allNews.sort((a, b) -> {
            if (a.getPublishedAt() == null) return 1;
            if (b.getPublishedAt() == null) return -1;
            return b.getPublishedAt().compareTo(a.getPublishedAt());
        });

        return allNews.size() > 20 ? allNews.subList(0, 20) : allNews;
    }

    /**
     * Simple RSS XML parser (no ROME dependency needed for basic parsing).
     */
    private List<NewsItem> parseRssFeed(String feedUrl) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(feedUrl))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", "StockLab/1.0")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("HTTP " + response.statusCode());
        }

        String xml = response.body();
        List<NewsItem> items = new ArrayList<>();

        // Simple XML parsing for RSS <item> elements
        String[] rawItems = xml.split("<item>");
        for (int i = 1; i < rawItems.length && i <= 10; i++) { // Skip first (before any <item>)
            String itemXml = rawItems[i];
            NewsItem item = new NewsItem();
            item.setTitle(extractXmlTag(itemXml, "title"));
            item.setLink(extractXmlTag(itemXml, "link"));
            item.setDescription(cleanHtml(extractXmlTag(itemXml, "description")));
            item.setPublishedAt(extractXmlTag(itemXml, "pubDate"));
            item.setSource(feedUrl.contains("vneconomy") ? "VnEconomy" : "VnExpress");

            // Try to extract image from description or enclosure
            String enclosure = extractXmlAttribute(itemXml, "enclosure", "url");
            if (enclosure != null) {
                item.setThumbnail(enclosure);
            }

            if (item.getTitle() != null && !item.getTitle().isBlank()) {
                items.add(item);
            }
        }

        log.debug("Parsed {} items from {}", items.size(), feedUrl);
        return items;
    }

    private String extractXmlTag(String xml, String tag) {
        // Handle CDATA
        String cdataPattern = "<" + tag + "><![CDATA[";
        int cdataStart = xml.indexOf(cdataPattern);
        if (cdataStart >= 0) {
            int contentStart = cdataStart + cdataPattern.length();
            int contentEnd = xml.indexOf("]]>", contentStart);
            if (contentEnd > contentStart) {
                return xml.substring(contentStart, contentEnd).trim();
            }
        }

        // Normal tag
        String startTag = "<" + tag + ">";
        String endTag = "</" + tag + ">";
        int start = xml.indexOf(startTag);
        int end = xml.indexOf(endTag);
        if (start >= 0 && end > start) {
            return xml.substring(start + startTag.length(), end).trim();
        }
        return null;
    }

    private String extractXmlAttribute(String xml, String tag, String attr) {
        String search = "<" + tag + " ";
        int tagStart = xml.indexOf(search);
        if (tagStart >= 0) {
            String attrSearch = attr + "=\"";
            int attrStart = xml.indexOf(attrSearch, tagStart);
            if (attrStart >= 0) {
                int valStart = attrStart + attrSearch.length();
                int valEnd = xml.indexOf("\"", valStart);
                if (valEnd > valStart) {
                    return xml.substring(valStart, valEnd);
                }
            }
        }
        return null;
    }

    private String cleanHtml(String html) {
        if (html == null) return null;
        return html.replaceAll("<[^>]+>", "").replaceAll("&amp;", "&")
                .replaceAll("&lt;", "<").replaceAll("&gt;", ">")
                .replaceAll("&nbsp;", " ").trim();
    }

    private void cacheNews(List<NewsItem> news) {
        try {
            String json = objectMapper.writeValueAsString(news);
            redis.opsForValue().set(NEWS_CACHE_KEY, json, NEWS_CACHE_TTL, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.debug("Cache write failed: {}", e.getMessage());
        }
    }

    /**
     * Refresh news cache every 15 minutes.
     */
    @Scheduled(fixedRate = 900000) // 15 min
    public void refreshNewsCache() {
        try {
            List<NewsItem> news = fetchAllFeeds();
            cacheNews(news);
            log.info("News cache refreshed: {} items", news.size());
        } catch (Exception e) {
            log.warn("News cache refresh failed: {}", e.getMessage());
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NewsItem {
        private String title;
        private String link;
        private String description;
        private String publishedAt;
        private String source;
        private String thumbnail;
    }
}

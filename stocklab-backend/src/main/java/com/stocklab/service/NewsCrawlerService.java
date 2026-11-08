package com.stocklab.service;

import com.stocklab.presentation.dto.CrawlResultResponse;
import com.stocklab.domain.model.NewsArticle;
import com.stocklab.domain.model.Stock;
import com.stocklab.infrastructure.repository.NewsArticleRepository;
import com.stocklab.infrastructure.repository.StockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class NewsCrawlerService {

    private final NewsArticleRepository newsArticleRepository;
    private final StockRepository stockRepository;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    private final AtomicBoolean isCrawling = new AtomicBoolean(false);
    private LocalDateTime lastCrawlTime = null;
    private int lastNewArticlesCount = 0;
    private int lastDuplicatesCount = 0;

    // 6 reputable financial and securities news RSS feeds in Vietnam
    public static final List<FeedSource> RSS_FEEDS = List.of(
            new FeedSource("CafeF", "https://cafef.vn/thi-truong-chung-khoan.rss"),
            new FeedSource("CafeF", "https://cafef.vn/tai-chinh-ngan-hang.rss"),
            new FeedSource("VnEconomy", "https://vneconomy.vn/chung-khoan.rss"),
            new FeedSource("VnEconomy", "https://vneconomy.vn/tai-chinh-ngan-hang.rss"),
            new FeedSource("Tuổi Trẻ", "https://tuoitre.vn/rss/tai-chinh.rss"),
            new FeedSource("VnExpress", "https://vnexpress.net/rss/kinh-doanh.rss")
    );

    public record FeedSource(String name, String url) {}

    /**
     * Scheduled crawler: runs every 3 hours (at 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
     */
    @Scheduled(cron = "0 0 */3 * * *")
    public void scheduledCrawl() {
        log.info("[NewsCrawler] Kích hoạt tiến trình cào tin tức định kỳ (mỗi 3 tiếng)...");
        crawlNewsInternal();
    }

    /**
     * Daily cleanup: runs at 02:00 AM every day to delete news older than 60 days
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void scheduledCleanup() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(60);
            newsArticleRepository.deleteByPublishedAtBefore(cutoff);
            log.info("[NewsCrawler] Đã dọn dẹp các tin tức cũ trước {}", cutoff);
        } catch (Exception e) {
            log.warn("[NewsCrawler] Lỗi khi dọn dẹp tin tức cũ: {}", e.getMessage());
        }
    }

    /**
     * Cold start: purge legacy non-financial news and trigger initial crawl if needed
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        new Thread(() -> {
            try {
                Thread.sleep(5000); // Wait 5 seconds for application to fully boot
                List<String> tickers = stockRepository.findAll().stream()
                        .map(Stock::getTicker)
                        .filter(Objects::nonNull)
                        .map(String::toUpperCase)
                        .toList();
                purgeNonFinancialArticles(tickers);

                long count = newsArticleRepository.count();
                if (count < 10) {
                    log.info("[NewsCrawler] CSDL tin tức cần cập nhật tin tài chính mới, tiến hành cào...");
                    crawlNewsInternal();
                }
            } catch (Exception e) {
                log.debug("[NewsCrawler] Startup check: {}", e.getMessage());
            }
        }).start();
    }

    /**
     * Manual crawl trigger (for Admin API)
     */
    public CrawlResultResponse crawlNewsNow() {
        long start = System.currentTimeMillis();
        if (!isCrawling.compareAndSet(false, true)) {
            return CrawlResultResponse.builder()
                    .sourcesProcessed(0)
                    .newArticles(0)
                    .duplicatesSkipped(0)
                    .totalArticlesInDb(newsArticleRepository.count())
                    .durationMs(System.currentTimeMillis() - start)
                    .lastCrawlTime(lastCrawlTime)
                    .build();
        }

        try {
            return executeCrawl(start);
        } finally {
            isCrawling.set(false);
        }
    }

    private void crawlNewsInternal() {
        if (!isCrawling.compareAndSet(false, true)) {
            log.warn("[NewsCrawler] Đang có tiến trình cào tin khác chạy, bỏ qua lần này.");
            return;
        }
        try {
            executeCrawl(System.currentTimeMillis());
        } finally {
            isCrawling.set(false);
        }
    }

    private CrawlResultResponse executeCrawl(long startTime) {
        int newArticles = 0;
        int duplicatesSkipped = 0;
        int sourcesProcessed = 0;

        // Preload active stock tickers for tagging
        List<String> tickers = stockRepository.findAll().stream()
                .map(Stock::getTicker)
                .filter(Objects::nonNull)
                .map(String::toUpperCase)
                .toList();

        // 1. Purge any legacy non-financial articles from database
        purgeNonFinancialArticles(tickers);

        // 2. Fetch up to 5 strictly financial articles per feed
        for (FeedSource feed : RSS_FEEDS) {
            try {
                sourcesProcessed++;
                List<RawNewsItem> items = fetchAndParseTop5(feed.url(), feed.name(), tickers);
                for (RawNewsItem item : items) {
                    // Double check financial relevance before saving
                    if (!isFinanciallyRelevant(item.title(), item.description(), tickers)) {
                        continue;
                    }

                    String cleanUrl = cleanUrl(item.link());
                    String guid = item.guid() != null && !item.guid().isBlank() ? item.guid().trim() : cleanUrl;
                    String guidHash = computeSha256(cleanUrl + "|" + guid);

                    // Check deduplication
                    if (newsArticleRepository.existsByGuidHash(guidHash)) {
                        duplicatesSkipped++;
                        continue;
                    }

                    // Ticker Tagging
                    String relatedTickers = matchTickers(item.title(), item.description(), tickers);

                    NewsArticle article = NewsArticle.builder()
                            .guidHash(guidHash)
                            .title(item.title())
                            .link(cleanUrl)
                            .description(item.description())
                            .thumbnailUrl(item.thumbnailUrl())
                            .source(feed.name())
                            .relatedTickers(relatedTickers)
                            .publishedAt(item.publishedAt() != null ? item.publishedAt() : LocalDateTime.now())
                            .build();

                    newsArticleRepository.save(article);
                    newArticles++;
                }
            } catch (Exception e) {
                log.warn("[NewsCrawler] Lỗi khi cào từ nguồn {} ({}): {}", feed.name(), feed.url(), e.getMessage());
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        this.lastCrawlTime = LocalDateTime.now();
        this.lastNewArticlesCount = newArticles;
        this.lastDuplicatesCount = duplicatesSkipped;

        long totalInDb = newsArticleRepository.count();
        log.info("[NewsCrawler] Hoàn tất cào tin tài chính: {} nguồn, {} bài mới, {} bài trùng lặp (Tổng trong DB: {} bài, Thời gian: {}ms)",
                sourcesProcessed, newArticles, duplicatesSkipped, totalInDb, duration);

        return CrawlResultResponse.builder()
                .sourcesProcessed(sourcesProcessed)
                .newArticles(newArticles)
                .duplicatesSkipped(duplicatesSkipped)
                .totalArticlesInDb(totalInDb)
                .durationMs(duration)
                .lastCrawlTime(lastCrawlTime)
                .build();
    }

    public CrawlResultResponse getCrawlStats() {
        return CrawlResultResponse.builder()
                .sourcesProcessed(RSS_FEEDS.size())
                .newArticles(lastNewArticlesCount)
                .duplicatesSkipped(lastDuplicatesCount)
                .totalArticlesInDb(newsArticleRepository.count())
                .durationMs(0)
                .lastCrawlTime(lastCrawlTime)
                .build();
    }

    /**
     * Parses strictly up to 5 newest *financially relevant* items from the RSS feed
     */
    private List<RawNewsItem> fetchAndParseTop5(String feedUrl, String sourceName, List<String> activeTickers) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(feedUrl))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .header("Accept", "application/rss+xml, application/xml, text/xml, */*")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() != 200) {
            throw new RuntimeException("HTTP status " + response.statusCode());
        }

        String xml = response.body();
        List<RawNewsItem> results = new ArrayList<>();

        String[] itemBlocks = xml.split("(?i)<item>");
        // Scan items in chronological order until we collect up to 5 strictly financial articles
        for (int i = 1; i < itemBlocks.length && results.size() < 5; i++) {
            String block = itemBlocks[i];
            int closeIndex = block.toLowerCase().indexOf("</item>");
            if (closeIndex > 0) {
                block = block.substring(0, closeIndex);
            }

            String title = extractTag(block, "title");
            String link = extractTag(block, "link");
            String guid = extractTag(block, "guid");
            String descRaw = extractTag(block, "description");
            String pubDateStr = extractTag(block, "pubDate");

            if (title == null || title.isBlank() || link == null || link.isBlank()) {
                continue;
            }

            String cleanTitle = cleanCdata(title).trim();
            String cleanDesc = cleanHtml(descRaw);
            if (cleanDesc.length() > 600) {
                cleanDesc = cleanDesc.substring(0, 597) + "...";
            }

            // FINANCIAL RELEVANCE GATE: Discard any non-financial articles
            if (!isFinanciallyRelevant(cleanTitle, cleanDesc, activeTickers)) {
                log.debug("[NewsCrawler] Bỏ qua tin không thuộc lĩnh vực tài chính: {}", cleanTitle);
                continue;
            }

            // Extract thumbnail
            String thumb = extractThumbnail(block, descRaw, sourceName);
            LocalDateTime pubDate = parsePublishedDate(pubDateStr);

            results.add(new RawNewsItem(
                    cleanTitle,
                    cleanCdata(link).trim(),
                    guid != null ? cleanCdata(guid).trim() : null,
                    cleanDesc,
                    thumb,
                    pubDate
            ));
        }

        return results;
    }

    /**
     * Strict Financial & Economic Relevance Gate.
     * Ensures only news directly discussing securities, financial markets, banking,
     * commodities, macroeconomic indicators, or listed companies are admitted.
     */
    public boolean isFinanciallyRelevant(String title, String description, List<String> activeTickers) {
        if (title == null || title.isBlank()) return false;
        String fullText = ((title != null ? title : "") + " " + (description != null ? description : "")).toLowerCase();

        // 1. Ticker match with word boundary
        if (activeTickers != null && !activeTickers.isEmpty()) {
            String upper = fullText.toUpperCase();
            for (String ticker : activeTickers) {
                if (ticker.length() >= 3 && Pattern.compile("\\b" + Pattern.quote(ticker) + "\\b").matcher(upper).find()) {
                    return true;
                }
            }
        }

        // 2. High-confidence financial / stock market keywords
        String[] keywords = {
            "chứng khoán", "cổ phiếu", "trái phiếu", "thị trường vốn", "vn-index", "hnx-index",
            "upcom", "hose", "hnx", "vn30", "ttck", "ubck", "ubcknn",
            "thanh khoản", "khớp lệnh", "khối ngoại", "tự doanh", "bán ròng", "mua ròng",
            "bắt đáy", "tạo đáy", "đảo chiều", "bán tháo", "chốt lời", "cắt lỗ", "margin",
            "vốn hóa", "niêm yết", "ipo", "room ngoại", "cổ tức",
            "tài chính", "ngân hàng", "lãi suất", "tín dụng", "nợ xấu", "tiền tệ",
            "ngân hàng nhà nước", "fed", "tỷ giá", "ngoại hối", "dự trữ ngoại hối",
            "doanh thu", "lợi nhuận", "báo cáo tài chính", "kết quả kinh doanh", "bctc",
            "m&a", "thâu tóm", "sáp nhập", "phát hành cổ phiếu", "tăng vốn", "đại hội cổ đông",
            "đhcđ", "hội đồng quản trị", "hđqt", "giá vàng", "vàng miếng", "vàng nhẫn", "sjc",
            "giá dầu", "dầu thô", "lạm phát", "cpi", "gdp", "quỹ đầu tư", "etf",
            "nasdaq", "dow jones", "s&p 500", "dòng tiền", "bảng lương phi nông nghiệp"
        };

        boolean matchedKeyword = false;
        for (String kw : keywords) {
            if (fullText.contains(kw)) {
                matchedKeyword = true;
                break;
            }
        }

        if (!matchedKeyword) {
            return false;
        }

        // 3. Blacklist non-financial lifestyle/events/consumer topics
        String[] blacklist = {
            "vui chơi", "săn quà", "đêm hội", "gian hàng", "lễ hội", "ẩm thực", "du lịch",
            "thời trang", "showbiz", "hoa hậu", "nghệ sĩ", "bóng đá", "hội chợ", "nông sản bưởi",
            "giải trí", "cuộc thi hoa hậu", "quà tặng miễn phí", "vật liệu xanh"
        };

        for (String bl : blacklist) {
            if (fullText.contains(bl)) {
                // Must have explicit hard stock terms to override
                boolean override = fullText.contains("cổ phiếu") || fullText.contains("vn-index") || fullText.contains("cổ tức") || fullText.contains("chứng khoán");
                if (!override) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Purges any existing articles from the database that do not meet strict financial criteria.
     */
    public int purgeNonFinancialArticles(List<String> tickers) {
        try {
            List<NewsArticle> allArticles = newsArticleRepository.findAll();
            int deleted = 0;
            for (NewsArticle article : allArticles) {
                if (!isFinanciallyRelevant(article.getTitle(), article.getDescription(), tickers)) {
                    newsArticleRepository.delete(article);
                    deleted++;
                }
            }
            if (deleted > 0) {
                log.info("[NewsCrawler] Đã dọn dẹp {} bài viết không liên quan đến tài chính khỏi CSDL", deleted);
            }
            return deleted;
        } catch (Exception e) {
            log.warn("[NewsCrawler] Lỗi khi dọn dẹp bài phi tài chính: {}", e.getMessage());
            return 0;
        }
    }

    private String extractThumbnail(String block, String descRaw, String sourceName) {
        // 1. Try <enclosure url="...">
        String enclosure = extractAttr(block, "enclosure", "url");
        if (enclosure != null && !enclosure.isBlank()) return enclosure.trim();

        // 2. Try <media:content url="...">
        String media = extractAttr(block, "media:content", "url");
        if (media != null && !media.isBlank()) return media.trim();

        // 3. Try <img src="..."> in description
        if (descRaw != null) {
            Pattern imgPattern = Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
            Matcher matcher = imgPattern.matcher(descRaw);
            if (matcher.find()) {
                return matcher.group(1).trim();
            }
        }

        // 4. Default fallback thumbnails per source
        return switch (sourceName) {
            case "CafeF" -> "https://cafefcdn.com/web_images/cafef-share-fb.png";
            case "VnEconomy" -> "https://vneconomy.vn/assets/images/logo.png";
            case "VnExpress" -> "https://s1.vnecdn.net/vnexpress/restruct/i/v899/logo/social_logo_share.png";
            default -> "https://tuoitre.vn/assets/images/logo-tuoi-tre.png";
        };
    }

    private String matchTickers(String title, String description, List<String> activeTickers) {
        if (activeTickers == null || activeTickers.isEmpty()) return null;
        String text = ((title != null ? title : "") + " " + (description != null ? description : "")).toUpperCase();

        Set<String> matched = new LinkedHashSet<>();
        for (String ticker : activeTickers) {
            if (ticker.length() >= 3) {
                // Check word boundary: e.g. " HPG ", "(HPG)", "HPG,"
                Pattern p = Pattern.compile("\\b" + Pattern.quote(ticker) + "\\b");
                if (p.matcher(text).find()) {
                    matched.add(ticker);
                }
            }
        }

        return matched.isEmpty() ? null : String.join(",", matched);
    }

    private String cleanUrl(String url) {
        if (url == null) return "";
        return url.replaceAll("(?i)\\?utm_[^&]+(&|$)", "?")
                .replaceAll("(?i)&utm_[^&]+", "")
                .replaceAll("(?i)\\?ref=[^&]+(&|$)", "?")
                .replaceAll("(?i)&ref=[^&]+", "")
                .replaceAll("\\?$", "")
                .replaceAll("#.*$", "")
                .trim();
    }

    private String computeSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private String extractTag(String xml, String tag) {
        Pattern pattern = Pattern.compile("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(xml);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    private String extractAttr(String xml, String tag, String attr) {
        Pattern pattern = Pattern.compile("<" + tag + "[^>]+" + attr + "=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(xml);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    private String cleanCdata(String str) {
        if (str == null) return "";
        return str.replaceAll("^<!\\[CDATA\\[", "").replaceAll("\\]\\]>$", "").trim();
    }

    private String cleanHtml(String html) {
        if (html == null) return "";
        return cleanCdata(html)
                .replaceAll("<[^>]+>", "")
                .replaceAll("&amp;", "&")
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&quot;", "\"")
                .replaceAll("&apos;", "'")
                .replaceAll("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private LocalDateTime parsePublishedDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return LocalDateTime.now();
        }
        String clean = dateStr.trim();
        try {
            return ZonedDateTime.parse(clean, DateTimeFormatter.RFC_1123_DATE_TIME)
                    .withZoneSameInstant(ZoneId.of("Asia/Ho_Chi_Minh"))
                    .toLocalDateTime();
        } catch (Exception ignored) {}

        // Fallback with custom English formats (e.g. 2-digit year "Sun, 08 Nov 26 00:04:00 +0700")
        String[] patterns = {
                "EEE, dd MMM yy HH:mm:ss Z",
                "EEE, dd MMM yyyy HH:mm:ss Z",
                "EEE, dd MMM yyyy HH:mm:ss zzz",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd HH:mm:ss"
        };
        for (String pattern : patterns) {
            try {
                DateTimeFormatter fmt = DateTimeFormatter.ofPattern(pattern, Locale.ENGLISH);
                return ZonedDateTime.parse(clean, fmt)
                        .withZoneSameInstant(ZoneId.of("Asia/Ho_Chi_Minh"))
                        .toLocalDateTime();
            } catch (Exception ignored) {}
        }

        return LocalDateTime.now();
    }

    public record RawNewsItem(
            String title,
            String link,
            String guid,
            String description,
            String thumbnailUrl,
            LocalDateTime publishedAt
    ) {}
}

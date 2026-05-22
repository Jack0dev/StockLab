package com.stocklab.service.ai.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.stocklab.service.NewsService;
import com.stocklab.service.ai.AITool;
import com.stocklab.service.ai.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tool: get_financial_news
 * Retrieves latest financial news from Vietnamese RSS feeds.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GetFinancialNewsTool implements AITool {

    private final NewsService newsService;
    private final ObjectMapper objectMapper;

    @Override
    public String getName() {
        return "get_financial_news";
    }

    @Override
    public String getDescription() {
        return "Lấy tin tức tài chính, chứng khoán mới nhất từ VnEconomy và VnExpress. " +
               "Trả về 10 tin mới nhất với tiêu đề, mô tả, nguồn, và ngày đăng. " +
               "Sử dụng khi người dùng hỏi về tin tức thị trường, sự kiện tài chính, hoặc muốn cập nhật thông tin.";
    }

    @Override
    public JsonNode getParameterSchema() {
        // No parameters needed
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "OBJECT");
        schema.putObject("properties");
        return schema;
    }

    @Override
    public JsonNode execute(JsonNode args, UserContext context) {
        log.info("[Tool] get_financial_news: user={}", context.getUsername());

        List<NewsService.NewsItem> news = newsService.getLatestNews();

        ObjectNode result = objectMapper.createObjectNode();
        ArrayNode newsArray = result.putArray("articles");

        // Return top 10 for context window efficiency
        int limit = Math.min(news.size(), 10);
        for (int i = 0; i < limit; i++) {
            NewsService.NewsItem item = news.get(i);
            ObjectNode article = newsArray.addObject();
            article.put("title", item.getTitle());
            article.put("description", item.getDescription());
            article.put("source", item.getSource());
            article.put("publishedAt", item.getPublishedAt());
            article.put("link", item.getLink());
        }
        result.put("totalCount", news.size());

        return result;
    }

    @Override
    public int getTimeoutSeconds() {
        return 8;
    }

    @Override
    public int getCacheTtlSeconds() {
        return 300; // 5 minutes
    }
}

package com.stocklab.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.*;

/**
 * Executes AI tools with timeout, Redis caching, and error handling.
 * Separation layer between Gemini's function calls and actual service invocation.
 */
@Component
@Slf4j
public class ToolExecutor {

    private final ToolRegistry toolRegistry;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor;

    private static final String TOOL_CACHE_PREFIX = "ai:tool:cache:";

    public ToolExecutor(ToolRegistry toolRegistry, StringRedisTemplate redis) {
        this.toolRegistry = toolRegistry;
        this.redis = redis;
        this.objectMapper = new ObjectMapper();
        this.executor = Executors.newFixedThreadPool(4);
    }

    /**
     * Execute a tool by name with timeout, caching, and error handling.
     */
    public ToolCallResult execute(String toolName, JsonNode args, UserContext context) {
        long startTime = System.currentTimeMillis();

        AITool tool = toolRegistry.getTool(toolName);
        if (tool == null) {
            return ToolCallResult.builder()
                    .toolName(toolName)
                    .success(false)
                    .error("Unknown tool: " + toolName)
                    .executionTimeMs(System.currentTimeMillis() - startTime)
                    .build();
        }

        // Check cache first
        String cacheKey = buildCacheKey(toolName, args, context);
        if (tool.getCacheTtlSeconds() > 0) {
            ToolCallResult cached = getFromCache(cacheKey, toolName);
            if (cached != null) {
                log.debug("[ToolExecutor] Cache hit: {} ({}ms)", toolName, System.currentTimeMillis() - startTime);
                return cached;
            }
        }

        // Execute with timeout
        try {
            CompletableFuture<JsonNode> future = CompletableFuture.supplyAsync(
                    () -> tool.execute(args, context), executor);

            JsonNode result = future.get(tool.getTimeoutSeconds(), TimeUnit.SECONDS);

            ToolCallResult callResult = ToolCallResult.builder()
                    .toolName(toolName)
                    .result(result)
                    .success(true)
                    .executionTimeMs(System.currentTimeMillis() - startTime)
                    .fromCache(false)
                    .source(buildSourceDescription(toolName, args))
                    .build();

            // Cache result
            if (tool.getCacheTtlSeconds() > 0) {
                cacheResult(cacheKey, callResult, tool.getCacheTtlSeconds());
            }

            log.info("[ToolExecutor] {} executed in {}ms", toolName, callResult.getExecutionTimeMs());
            return callResult;

        } catch (TimeoutException e) {
            log.warn("[ToolExecutor] {} timed out after {}s", toolName, tool.getTimeoutSeconds());
            return ToolCallResult.builder()
                    .toolName(toolName)
                    .success(false)
                    .error("Tool timed out after " + tool.getTimeoutSeconds() + "s")
                    .executionTimeMs(System.currentTimeMillis() - startTime)
                    .build();

        } catch (Exception e) {
            log.error("[ToolExecutor] {} failed: {}", toolName, e.getMessage());
            return ToolCallResult.builder()
                    .toolName(toolName)
                    .success(false)
                    .error("Tool execution failed: " + e.getMessage())
                    .executionTimeMs(System.currentTimeMillis() - startTime)
                    .build();
        }
    }

    private String buildCacheKey(String toolName, JsonNode args, UserContext context) {
        // Portfolio is user-specific, others are shared
        if ("get_portfolio".equals(toolName)) {
            return TOOL_CACHE_PREFIX + toolName + ":" + context.getUserId();
        }
        return TOOL_CACHE_PREFIX + toolName + ":" + (args != null ? args.toString().hashCode() : "noargs");
    }

    private ToolCallResult getFromCache(String cacheKey, String toolName) {
        try {
            String cached = redis.opsForValue().get(cacheKey);
            if (cached != null) {
                JsonNode result = objectMapper.readTree(cached);
                return ToolCallResult.builder()
                        .toolName(toolName)
                        .result(result)
                        .success(true)
                        .executionTimeMs(0)
                        .fromCache(true)
                        .source("Cached")
                        .build();
            }
        } catch (Exception e) {
            log.debug("[ToolExecutor] Cache read error: {}", e.getMessage());
        }
        return null;
    }

    private void cacheResult(String cacheKey, ToolCallResult result, int ttlSeconds) {
        try {
            if (result.getResult() != null) {
                String json = objectMapper.writeValueAsString(result.getResult());
                redis.opsForValue().set(cacheKey, json, ttlSeconds, TimeUnit.SECONDS);
            }
        } catch (Exception e) {
            log.debug("[ToolExecutor] Cache write error: {}", e.getMessage());
        }
    }

    private String buildSourceDescription(String toolName, JsonNode args) {
        return switch (toolName) {
            case "get_stock_signal" -> "ML Signal " + (args != null && args.has("ticker") ? args.get("ticker").asText() : "");
            case "get_stock_price" -> "Stock Price " + (args != null && args.has("ticker") ? args.get("ticker").asText() : "");
            case "get_financial_news" -> "VnEconomy/VnExpress RSS";
            case "get_portfolio" -> "User Portfolio";
            case "get_market_overview" -> "Market Overview (20 stocks)";
            default -> toolName;
        };
    }
}

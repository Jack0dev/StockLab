package com.stocklab.service;

import com.stocklab.service.ai.*;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * AI Assistant Service — Orchestrator for Hybrid RAG Architecture.
 *
 * Flow:
 *   User message → Rate limit check → GeminiClient (Function Calling)
 *     → Gemini decides: direct answer OR tool calls
 *     → ToolExecutor handles tool execution (timeout, cache, auth)
 *     → Gemini synthesizes final response with real data
 */
@Service
@Slf4j
public class AIAssistantService {

    @Value("${app.gemini.max-requests-per-day:20}")
    private int maxRequestsPerDay;

    private final StringRedisTemplate redis;
    private final GeminiClient geminiClient;

    private static final String RATE_LIMIT_PREFIX = "ai:ratelimit:";

    public AIAssistantService(StringRedisTemplate redis, GeminiClient geminiClient) {
        this.redis = redis;
        this.geminiClient = geminiClient;
    }

    /**
     * Chat with AI assistant using Hybrid RAG.
     * Gemini autonomously decides which tools to call based on the user's question.
     */
    public ChatResponse chat(Long userId, String username, String email, String userMessage) {
        // Rate limiting
        if (!checkRateLimit(userId)) {
            return ChatResponse.rateLimited(maxRequestsPerDay);
        }

        // Build user context (auth-injected, NOT from Gemini)
        UserContext context = new UserContext(userId, username, email);

        // Execute via GeminiClient (handles function calling loop)
        GeminiClient.GeminiResponse response = geminiClient.chat(userMessage, context);

        // Increment rate limit on success
        if (response.isSuccess()) {
            incrementRateLimit(userId);
        }

        int remaining = getRemainingQuota(userId);

        return new ChatResponse(
                response.getMessage(),
                !response.isSuccess(),
                response.getToolsUsed(),
                response.getSources(),
                remaining
        );
    }

    /**
     * Chat with AI using Server-Sent Events (SSE) streaming.
     */
    public void chatStream(Long userId, String username, String email, String userMessage, org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter) {
        if (!checkRateLimit(userId)) {
            try {
                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("error").data(java.util.Map.of("message", "Bạn đã đạt giới hạn " + maxRequestsPerDay + " câu hỏi/ngày.")));
                emitter.complete();
            } catch (Exception ignored) {}
            return;
        }

        UserContext context = new UserContext(userId, username, email);

        // Heartbeat scheduler to keep connection alive
        java.util.concurrent.ScheduledExecutorService scheduler = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> {
            try {
                synchronized (emitter) {
                    emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("ping").data("keepalive"));
                }
            } catch (Exception e) {
                scheduler.shutdown();
            }
        }, 15, 15, java.util.concurrent.TimeUnit.SECONDS);

        java.util.concurrent.atomic.AtomicBoolean isCancelled = new java.util.concurrent.atomic.AtomicBoolean(false);
        Runnable cleanup = () -> {
            isCancelled.set(true);
            scheduler.shutdown();
        };

        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                geminiClient.chatStream(userMessage, context, event -> {
                    try {
                        synchronized (emitter) {
                            if (event instanceof StreamEvent.TextDelta e) {
                                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("text").data(java.util.Map.of("delta", e.text())));
                            } else if (event instanceof StreamEvent.ToolStart e) {
                                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("tool_start").data(java.util.Map.of("tool", e.tool())));
                            } else if (event instanceof StreamEvent.ToolResultEvent e) {
                                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("tool_result").data(java.util.Map.of("tool", e.tool(), "payload", e.payload())));
                            } else if (event instanceof StreamEvent.SourceEvent e) {
                                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("source").data(java.util.Map.of("sources", e.sources())));
                            } else if (event instanceof StreamEvent.DoneEvent) {
                                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("done").data(java.util.Map.of()));
                            } else if (event instanceof StreamEvent.ErrorEvent e) {
                                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("error").data(java.util.Map.of("message", e.message())));
                            }
                        }
                    } catch (Exception ex) {
                        isCancelled.set(true);
                    }
                }, isCancelled::get);

                incrementRateLimit(userId);
                // Let the client close the connection via abort() to prevent ERR_INCOMPLETE_CHUNKED_ENCODING
            } catch (Exception e) {
                log.error("[AIAssistant] Streaming error", e);
                try {
                    synchronized (emitter) {
                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("error").data(java.util.Map.of("message", "Đã xảy ra lỗi kết nối AI")));
                    }
                } catch (Exception ignored) {}
            } finally {
                cleanup.run();
            }
        });
    }

    /**
     * Get remaining daily quota for a user.
     */
    public int getRemainingQuota(Long userId) {
        String key = RATE_LIMIT_PREFIX + userId + ":" + LocalDate.now();
        String count = redis.opsForValue().get(key);
        int used = count != null ? Integer.parseInt(count) : 0;
        return Math.max(0, maxRequestsPerDay - used);
    }

    /**
     * Get list of available tool names.
     */
    public List<String> getAvailableTools() {
        // Delegate to GeminiClient's tool registry (accessible indirectly)
        return List.of(
                "get_stock_signal",
                "get_stock_price",
                "get_financial_news",
                "get_portfolio",
                "get_market_overview"
        );
    }

    private boolean checkRateLimit(Long userId) {
        String key = RATE_LIMIT_PREFIX + userId + ":" + LocalDate.now();
        String count = redis.opsForValue().get(key);
        if (count != null && Integer.parseInt(count) >= maxRequestsPerDay) {
            return false;
        }
        return true;
    }

    private void incrementRateLimit(Long userId) {
        String key = RATE_LIMIT_PREFIX + userId + ":" + LocalDate.now();
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, 24, TimeUnit.HOURS);
        }
    }

    /**
     * Chat response DTO — no internal reasoning exposed to frontend.
     */
    @Data
    public static class ChatResponse {
        private final String message;
        private final boolean error;
        private final List<String> toolsUsed;    // Tools Gemini called
        private final List<String> sources;       // Human-readable data sources
        private final int remainingQuota;         // Remaining daily questions

        public ChatResponse(String message, boolean error, List<String> toolsUsed,
                            List<String> sources, int remainingQuota) {
            this.message = message;
            this.error = error;
            this.toolsUsed = toolsUsed != null ? toolsUsed : List.of();
            this.sources = sources != null ? sources : List.of();
            this.remainingQuota = remainingQuota;
        }

        public static ChatResponse rateLimited(int maxPerDay) {
            return new ChatResponse(
                    "Bạn đã đạt giới hạn " + maxPerDay + " câu hỏi/ngày. Vui lòng quay lại ngày mai.",
                    true, List.of(), List.of(), 0
            );
        }
    }
}

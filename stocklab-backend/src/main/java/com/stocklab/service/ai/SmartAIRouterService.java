package com.stocklab.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Smart AI Router — LUÔN thử Local AI trước, fallback Gemini khi lỗi.
 *
 * Strategy:
 *   1. LUÔN gửi câu hỏi đến Local AI (Ollama) trước
 *   2. Nếu Local AI lỗi (connection refused, timeout, model fail) → tự động chuyển sang Gemini
 *   3. Gửi event "model_info" để Frontend biết đang dùng model nào
 *   4. Nếu fallback xảy ra, gửi event "model_switch" để Frontend cập nhật badge
 */
@Service
@Slf4j
public class SmartAIRouterService {

    private final LocalAIService localAIService;
    private final com.stocklab.service.AIAssistantService aiAssistantService;
    private final HttpClient httpClient;

    public SmartAIRouterService(LocalAIService localAIService,
                                 com.stocklab.service.AIAssistantService aiAssistantService) {
        this.localAIService = localAIService;
        this.aiAssistantService = aiAssistantService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
    }

    /**
     * Smart chat stream — ALWAYS tries Local AI first, falls back to Gemini on error.
     */
    public void chatStream(String question, SseEmitter emitter, UserContext userContext) {
        log.info("[SmartRouter] Attempting Local AI first for user={}", userContext.getUsername());

        // Step 1: Send initial model_info = local
        sendModelInfo(emitter, "local", "Local AI (Qwen 2.5)");

        // Step 2: Try Local AI with fallback to Gemini on error
        localAIService.chatStreamLocal(question, emitter, userContext, (errorMessage) -> {
            log.warn("[SmartRouter] Local AI failed: {}. Falling back to Gemini.", errorMessage);

            // Notify frontend: switching model
            try {
                synchronized (emitter) {
                    emitter.send(SseEmitter.event().name("model_switch").data(Map.of(
                            "from", "local",
                            "to", "gemini",
                            "reason", errorMessage != null ? errorMessage : "Local AI không khả dụng"
                    )));
                    // Update model_info to gemini
                    emitter.send(SseEmitter.event().name("model_info").data(Map.of(
                            "model", "gemini",
                            "modelName", "Gemini API"
                    )));
                }
            } catch (Exception e) {
                log.warn("[SmartRouter] Failed to send model_switch event");
            }

            // Delegate to Gemini
            aiAssistantService.chatStream(
                    userContext.getUserId(),
                    userContext.getUsername(),
                    userContext.getEmail(),
                    question,
                    emitter
            );
        });
    }

    /**
     * Send model_info SSE event.
     */
    private void sendModelInfo(SseEmitter emitter, String model, String modelName) {
        try {
            synchronized (emitter) {
                emitter.send(SseEmitter.event().name("model_info").data(Map.of(
                        "model", model,
                        "modelName", modelName
                )));
            }
        } catch (Exception e) {
            log.warn("[SmartRouter] Failed to send model_info event");
        }
    }

    /**
     * Quick check if Ollama is available (for status endpoint only).
     */
    private boolean isOllamaAvailable() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:11434/api/tags"))
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get router status info.
     */
    public Map<String, Object> getRouterStatus() {
        boolean local = isOllamaAvailable();
        return Map.of(
                "activeModel", local ? "local" : "gemini",
                "activeModelName", local ? "Local AI (Qwen 2.5)" : "Gemini API",
                "ollamaAvailable", local,
                "strategy", "local-first-with-auto-fallback"
        );
    }
}

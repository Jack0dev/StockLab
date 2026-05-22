package com.stocklab.controller;

import com.stocklab.model.User;
import com.stocklab.service.AIAssistantService;
import com.stocklab.service.AIAssistantService.ChatResponse;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.stocklab.service.ai.LocalAIService;
import com.stocklab.service.ai.RagTrainingService;
import com.stocklab.service.ai.SmartAIRouterService;

import java.util.List;
import java.util.Map;

/**
 * AI Assistant Controller — Hybrid RAG Chatbot endpoints.
 *
 * POST /api/ai/chat    — Chat with AI (Function Calling + RAG)
 * GET  /api/ai/tools   — List available tools
 * GET  /api/ai/quota    — Get remaining daily quota
 * GET  /api/ai/history — Clear chat history
 * POST /api/ai/chat/stream — Chat with AI (SSE Streaming)
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AIController {

    private final AIAssistantService aiService;
    private final com.stocklab.repository.UserRepository userRepository;
    private final com.stocklab.service.ai.ChatMemoryService chatMemoryService;
    private final LocalAIService localAIService;
    private final RagTrainingService ragTrainingService;
    private final SmartAIRouterService smartAIRouterService;

    /**
     * POST /api/ai/chat — Main chat endpoint.
     * Gemini autonomously decides which tools to call.
     */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody ChatRequest request) {

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        ChatResponse response = aiService.chat(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                request.getMessage()
        );

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/ai/chat/stream — Streaming chat endpoint using SSE.
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter chatStream(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody ChatRequest request) {

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Set timeout to 5 minutes
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(300000L);

        // Manage emitter state
        emitter.onCompletion(() -> {
            // Service should handle cancellation if needed
        });
        emitter.onTimeout(() -> {
            emitter.complete();
        });
        emitter.onError((e) -> {
            // Log error but do not call completeWithError to prevent ERR_INCOMPLETE_CHUNKED_ENCODING
            System.err.println("SseEmitter error: " + e.getMessage());
        });

        // Delegate to service to start background processing
        aiService.chatStream(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                request.getMessage(),
                emitter
        );

        return emitter;
    }

    /**
     * GET /api/ai/tools — List available AI tools.
     */
    @GetMapping("/tools")
    public ResponseEntity<Map<String, Object>> getTools() {
        List<String> tools = aiService.getAvailableTools();
        return ResponseEntity.ok(Map.of(
                "tools", tools,
                "count", tools.size()
        ));
    }

    /**
     * GET /api/ai/quota — Get remaining daily quota.
     */
    @GetMapping("/quota")
    public ResponseEntity<Map<String, Object>> getQuota(
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        int remaining = aiService.getRemainingQuota(user.getId());
        return ResponseEntity.ok(Map.of("remaining", remaining));
    }

    /**
     * DELETE /api/ai/history — Clear chat history.
     */
    @DeleteMapping("/history")
    public ResponseEntity<Map<String, String>> clearHistory(
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        chatMemoryService.clearHistory(user.getId());
        return ResponseEntity.ok(Map.of("status", "Chat history cleared"));
    }

    /**
     * POST /api/ai/local/train — Train Local AI with a document
     */
    @PostMapping(value = "/local/train", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> trainLocalModel(
            @RequestParam("file") MultipartFile file) {
        int chunks = ragTrainingService.trainDocument(file);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "chunksIndexed", chunks
        ));
    }

    /**
     * POST /api/ai/local/chat/stream — Streaming chat endpoint for Local AI
     */
    @PostMapping(value = "/local/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter chatLocalStream(
            @RequestBody ChatRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        com.stocklab.service.ai.UserContext userContext = new com.stocklab.service.ai.UserContext(
                user.getId(), user.getUsername(), user.getEmail());

        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(300000L);

        emitter.onTimeout(() -> {
            // do nothing
        });

        localAIService.chatStreamLocal(request.getMessage(), emitter, userContext);

        return emitter;
    }

    /**
     * POST /api/ai/smart/chat/stream — Unified Smart AI endpoint.
     * Automatically selects Local AI or Gemini API based on availability.
     */
    @PostMapping(value = "/smart/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter smartChatStream(
            @RequestBody ChatRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        com.stocklab.service.ai.UserContext userContext = new com.stocklab.service.ai.UserContext(
                user.getId(), user.getUsername(), user.getEmail());

        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter =
                new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(300000L);

        emitter.onTimeout(() -> {});
        emitter.onError(e -> System.err.println("SmartAI SseEmitter error: " + e.getMessage()));

        smartAIRouterService.chatStream(request.getMessage(), emitter, userContext);

        return emitter;
    }

    /**
     * GET /api/ai/router/status — Check which AI model is currently active.
     */
    @GetMapping("/router/status")
    public ResponseEntity<java.util.Map<String, Object>> getRouterStatus() {
        return ResponseEntity.ok(smartAIRouterService.getRouterStatus());
    }

    @Data
    public static class ChatRequest {
        private String message;
    }
}
